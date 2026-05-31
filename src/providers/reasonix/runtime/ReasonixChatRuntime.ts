import {
  DeepSeekClient,
  CacheFirstLoop,
  ImmutablePrefix,
  ToolRegistry,
  registerFilesystemTools,
  registerShellTools,
  registerWebTools,
  registerMemoryTools,
  registerPlanTool,
  registerTodoTool,
  registerChoiceTool,
} from 'reasonix';
import type { LoopEvent } from 'reasonix';
import type {
  FilesystemToolsOptions,
  ShellToolsOptions,
  MemoryToolsOptions,
} from 'reasonix';

import { REASONIX_PROVIDER_CAPABILITIES } from '../capabilities';
import { getReasonixProviderSettings } from '../settings';
import type { ChatRuntime } from '../../../core/runtime/ChatRuntime';
import type { ProviderCapabilities } from '../../../core/providers/types';
import type {
  ApprovalCallback,
  AskUserQuestionCallback,
  AutoTurnResult,
  ChatRewindResult,
  ChatRuntimeConversationState,
  ChatRuntimeEnsureReadyOptions,
  ChatRuntimeQueryOptions,
  ChatTurnMetadata,
  ChatTurnRequest,
  ExitPlanModeCallback,
  PreparedChatTurn,
  SessionUpdateResult,
  SubagentRuntimeState,
} from '../../../core/runtime/types';
import type { ChatMessage, Conversation, SlashCommand, StreamChunk } from '../../../core/types';
import type ClaudianPlugin from '../../../main';
import { getVaultPath } from '../../../utils/path';
import { buildSystemPrompt } from '../../../core/prompt/mainAgent';

const PROVIDER_ID = 'reasonix';

export class ReasonixChatRuntime implements ChatRuntime {
  readonly providerId = PROVIDER_ID;

  private plugin!: ClaudianPlugin;
  private client: DeepSeekClient | null = null;
  private loop: CacheFirstLoop | null = null;
  private currentSystemPrompt: string = '';
  private sessionId: string | null = null;
  private _cancelled = false;

  // Callbacks
  private approvalCallback: ApprovalCallback | null = null;
  private askUserQuestionCallback: AskUserQuestionCallback | null = null;
  private exitPlanModeCallback: ExitPlanModeCallback | null = null;
  private autoTurnCallback: ((result: AutoTurnResult) => void) | null = null;

  setPlugin(plugin: ClaudianPlugin): void {
    this.plugin = plugin;
  }

  private getSettings() {
    return getReasonixProviderSettings(
      this.plugin.settings as unknown as Record<string, unknown>,
    );
  }

  private vaultPath(): string {
    return this.plugin ? (getVaultPath(this.plugin.app) ?? process.cwd()) : process.cwd();
  }

  private ensureClient(): DeepSeekClient {
    if (!this.client) {
      const settings = this.getSettings();
      this.client = new DeepSeekClient({
        apiKey: settings.apiKey || undefined,
        baseUrl: settings.baseUrl || undefined,
      });
    }
    return this.client;
  }

  private buildToolRegistry(): ToolRegistry {
    const registry = new ToolRegistry();
    const rootDir = this.vaultPath();

    const fsOpts: FilesystemToolsOptions = { rootDir };
    registerFilesystemTools(registry, fsOpts);

    const shellOpts: ShellToolsOptions = { rootDir };
    registerShellTools(registry, shellOpts);

    registerWebTools(registry);

    const memOpts: MemoryToolsOptions = { projectRoot: rootDir };
    registerMemoryTools(registry, memOpts);

    registerPlanTool(registry);
    registerTodoTool(registry);
    // registerSubagentTool requires a client instance — skip for now
    registerChoiceTool(registry);

    return registry;
  }

  private buildSystemPrompt(): string {
    const vaultPath = this.vaultPath();
    const settings = this.getSettings();
    const pluginSettings = this.plugin?.settings;

    return buildSystemPrompt({
      vaultPath,
      userName: pluginSettings?.userName,
      mediaFolder: pluginSettings?.mediaFolder,
      customPrompt: pluginSettings?.systemPrompt,
      memoryEnabled: true, // Always attempt memory injection
    });
  }

  // =========================================================================
  // ChatRuntime implementation
  // =========================================================================

  getCapabilities(): Readonly<ProviderCapabilities> {
    return REASONIX_PROVIDER_CAPABILITIES;
  }

  prepareTurn(request: ChatTurnRequest): PreparedChatTurn {
    return {
      request,
      persistedContent: request.text,
      prompt: this.currentSystemPrompt || this.buildSystemPrompt(),
      isCompact: false,
      mcpMentions: new Set(),
    };
  }

  onReadyStateChange(_listener: (ready: boolean) => void): () => void {
    return () => {};
  }

  setResumeCheckpoint(_checkpointId: string | undefined): void {}

  syncConversationState(
    _conversation: ChatRuntimeConversationState | null,
    _externalContextPaths?: string[],
  ): void {}

  async reloadMcpServers(): Promise<void> {}

  async ensureReady(_options?: ChatRuntimeEnsureReadyOptions): Promise<boolean> {
    return true;
  }

  async *query(
    turn: PreparedChatTurn,
    conversationHistory?: ChatMessage[],
    _queryOptions?: ChatRuntimeQueryOptions,
  ): AsyncGenerator<StreamChunk> {
    this._cancelled = false;
    const settings = this.getSettings();

    if (!this.currentSystemPrompt) {
      this.currentSystemPrompt = this.buildSystemPrompt();
    }

    const tools = this.buildToolRegistry();
    const prefix = new ImmutablePrefix({
      system: this.currentSystemPrompt,
      toolSpecs: tools.specs(),
      fewShots: [],
    });

    const client = this.ensureClient();
    this.loop = new CacheFirstLoop({
      client,
      prefix,
      tools,
      model: settings.model || 'deepseek-v4-flash',
      reasoningEffort: settings.reasoningEffort || 'high',
      maxOutputTokens: settings.maxOutputTokens || undefined,
      budgetUsd: settings.budgetUsd ?? undefined,
      session: this.sessionId ?? undefined,
      hookCwd: this.vaultPath(),
    });

    // Load conversation history
    if (conversationHistory?.length) {
      for (const msg of conversationHistory) {
        this.loop.log.append({
          role: msg.role,
          content: msg.content,
        } as any);
      }
    }

    yield { type: 'user_message_start', content: turn.persistedContent };

    try {
      for await (const event of this.loop.step(turn.persistedContent)) {
        if (this._cancelled) break;
        const chunk = this.mapLoopEvent(event);
        if (chunk) yield chunk;
      }
    } catch (err: any) {
      if (!this._cancelled) {
        yield { type: 'error', content: err?.message || String(err) };
      }
    }

    yield { type: 'done' };
  }

  private mapLoopEvent(event: LoopEvent): StreamChunk | null {
    switch (event.role) {
      case 'assistant_delta':
      case 'assistant_final':
        return { type: 'text', content: event.content };

      case 'tool_start':
        return {
          type: 'tool_use',
          id: event.callId ?? `tool-${Date.now()}`,
          name: event.toolName ?? 'unknown',
          input: safeParseJson(event.toolArgs) ?? {},
        };

      case 'tool':
        return {
          type: 'tool_result',
          id: event.callId ?? '',
          content: event.content,
        };

      case 'tool_call_delta':
      case 'status':
      case 'steer':
        return null;

      case 'error':
        return { type: 'error', content: event.error ?? event.content };

      case 'warning':
        return { type: 'notice', content: event.content, level: 'warning' as const };

      case 'done':
      default:
        return null;
    }
  }

  steer(_turn: PreparedChatTurn): Promise<boolean> {
    return Promise.resolve(false);
  }

  cancel(): void {
    this._cancelled = true;
    this.loop?.abort();
  }

  resetSession(): void {
    this.loop?.clearLog();
    this._cancelled = false;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  consumeSessionInvalidation(): boolean {
    return false;
  }

  isReady(): boolean {
    return true;
  }

  async getSupportedCommands(): Promise<SlashCommand[]> {
    return [];
  }

  cleanup(): void {
    this.cancel();
    this.client = null;
    this.loop = null;
    this.currentSystemPrompt = '';
  }

  async rewind(
    _userMessageId: string,
    _assistantMessageId: string,
  ): Promise<ChatRewindResult> {
    return { canRewind: false };
  }

  setApprovalCallback(callback: ApprovalCallback | null): void {
    this.approvalCallback = callback;
  }

  setApprovalDismisser(_dismisser: (() => void) | null): void {}

  setAskUserQuestionCallback(callback: AskUserQuestionCallback | null): void {
    this.askUserQuestionCallback = callback;
  }

  setExitPlanModeCallback(callback: ExitPlanModeCallback | null): void {
    this.exitPlanModeCallback = callback;
  }

  setPermissionModeSyncCallback(
    _callback: ((sdkMode: string) => void) | null,
  ): void {}

  setSubagentHookProvider(_getState: () => SubagentRuntimeState): void {}

  setAutoTurnCallback(
    callback: ((result: AutoTurnResult) => void) | null,
  ): void {
    this.autoTurnCallback = callback;
  }

  consumeTurnMetadata(): ChatTurnMetadata {
    return {};
  }

  buildSessionUpdates(_params: {
    conversation: Conversation | null;
    sessionInvalidated: boolean;
  }): SessionUpdateResult {
    return { updates: {} };
  }

  resolveSessionIdForFork(
    _conversation: Conversation | null,
  ): string | null {
    return null;
  }
}

function safeParseJson(raw: string | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
