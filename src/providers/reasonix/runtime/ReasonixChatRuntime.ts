// Minimal ReasonixChatRuntime — uses DeepSeekClient directly for chat,
// avoiding heavy Node.js dependencies (filesystem, shell, tree-sitter, etc.)
// that are incompatible with Obsidian's Electron renderer.

import { DeepSeekClient } from 'reasonix';
import type { ChatMessage as ReasonixChatMessage } from 'reasonix';

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

// Simple message store for conversation history (in-memory only)
interface StoredMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class ReasonixChatRuntime implements ChatRuntime {
  readonly providerId = PROVIDER_ID;

  private plugin!: ClaudianPlugin;
  private client: DeepSeekClient | null = null;
  private currentSystemPrompt: string = '';
  private sessionId: string | null = null;
  private _cancelled = false;
  private messageHistory: StoredMessage[] = [];

  // Callbacks
  private approvalCallback: ApprovalCallback | null = null;
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
    return this.plugin ? (getVaultPath(this.plugin.app) ?? '.') : '.';
  }

  private ensureClient(): DeepSeekClient {
    if (!this.client) {
      const settings = this.getSettings();
      if (!settings.apiKey) {
        throw new Error('DEEPSEEK_API_KEY is not set. Please add your API key in Reasonian settings.');
      }
      this.client = new DeepSeekClient({
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl || undefined,
      });
    }
    return this.client;
  }

  private buildSystemPromptText(): string {
    const vaultPath = this.vaultPath();
    const pluginSettings = this.plugin?.settings;

    return buildSystemPrompt({
      vaultPath,
      userName: pluginSettings?.userName,
      mediaFolder: pluginSettings?.mediaFolder,
      customPrompt: pluginSettings?.systemPrompt,
      memoryEnabled: true,
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
      prompt: this.currentSystemPrompt || this.buildSystemPromptText(),
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
      this.currentSystemPrompt = this.buildSystemPromptText();
    }

    const client = this.ensureClient();

    // Build messages array
    const messages: ReasonixChatMessage[] = [
      { role: 'system', content: this.currentSystemPrompt },
    ];

    // Add conversation history
    if (conversationHistory?.length) {
      for (const msg of conversationHistory) {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: turn.persistedContent,
    });

    yield { type: 'user_message_start', content: turn.persistedContent };

    let assistantContent = '';

    try {
      const stream = client.stream({
        model: settings.model || 'deepseek-v4-flash',
        messages,
        maxTokens: settings.maxOutputTokens || undefined,
        reasoningEffort: settings.reasoningEffort || 'high',
      });

      for await (const chunk of stream) {
        if (this._cancelled) break;

        if (chunk.contentDelta) {
          assistantContent += chunk.contentDelta;
          yield { type: 'text', content: chunk.contentDelta };
        }

        if (chunk.reasoningDelta) {
          yield { type: 'thinking', content: chunk.reasoningDelta };
        }

        if (chunk.usage) {
          const u = chunk.usage;
          const ctxTokens = u.totalTokens;
          yield {
            type: 'usage',
            usage: {
              model: settings.model,
              inputTokens: u.promptTokens,
              cacheCreationInputTokens: u.promptCacheMissTokens,
              cacheReadInputTokens: u.promptCacheHitTokens,
              contextWindow: 128000,
              contextTokens: ctxTokens,
              percentage: Math.round((ctxTokens / 128000) * 100),
            },
          };
        }
      }
    } catch (err: any) {
      if (!this._cancelled) {
        yield { type: 'error', content: err?.message || String(err) };
      }
    }

    // Store in history
    if (assistantContent) {
      this.messageHistory.push({ role: 'user', content: turn.persistedContent });
      this.messageHistory.push({ role: 'assistant', content: assistantContent });
    }

    yield { type: 'done' };
  }

  steer(_turn: PreparedChatTurn): Promise<boolean> {
    return Promise.resolve(false);
  }

  cancel(): void {
    this._cancelled = true;
  }

  resetSession(): void {
    this.messageHistory = [];
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
    this.currentSystemPrompt = '';
    this.messageHistory = [];
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
  setAskUserQuestionCallback(_callback: AskUserQuestionCallback | null): void {}
  setExitPlanModeCallback(_callback: ExitPlanModeCallback | null): void {}
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
