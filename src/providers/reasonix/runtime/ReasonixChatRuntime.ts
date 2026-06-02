import {
  CacheFirstLoop,
  DeepSeekClient,
  ImmutablePrefix,
  McpClient,
  SseTransport,
  StdioTransport,
  StreamableHttpTransport,
  ToolRegistry,
  bridgeMcpTools,
  registerChoiceTool,
  registerPlanTool,
  registerTodoTool,
} from 'reasonix';
import type {
  CacheFirstLoopOptions,
  ChatMessage as ReasonixChatMessage,
  LoopEvent,
  MemoryEntry,
  MemoryScope,
  ToolSpec,
} from 'reasonix';

import { REASONIX_PROVIDER_CAPABILITIES } from '../capabilities';
import {
  getReasonixProviderSettings,
  updateReasonixProviderSettings,
} from '../settings';
import type { ReasonixProviderSettings } from '../settings';
import { REASONIX_STATIC_COMMANDS } from '../app/ReasonixCommandCatalog';
import { ProviderWorkspaceRegistry } from '../../../core/providers/ProviderWorkspaceRegistry';
import type { ChatRuntime } from '../../../core/runtime/ChatRuntime';
import type { ProviderCapabilities } from '../../../core/providers/types';
import type { ManagedMcpServer, McpServerConfig } from '../../../core/types';
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
import {
  TOOL_ASK_USER_QUESTION,
  TOOL_TODO_WRITE,
} from '../../../core/tools/toolNames';
import type {
  ChatMessage,
  Conversation,
  SlashCommand,
  StreamChunk,
  UsageInfo,
} from '../../../core/types';
import type ClaudianPlugin from '../../../main';
import { getVaultPath } from '../../../utils/path';
import { buildSystemPrompt } from '../../../core/prompt/mainAgent';

const PROVIDER_ID = 'reasonix';
const DEFAULT_MODEL = 'deepseek-v4-flash';
const DEFAULT_CONTEXT_WINDOW = 1_000_000;
const FALLBACK_CONTEXT_WINDOW = 131_072;

type LoopConfirmationGate = NonNullable<CacheFirstLoopOptions['confirmationGate']>;

interface NormalizedToolUse {
  name: string;
  input: Record<string, unknown>;
  interactive: boolean;
}

interface ActiveMcpBridge {
  clients: McpClient[];
  toolNames: string[];
  key: string;
}

interface McpBridgeConfigurationResult {
  changed: boolean;
  notices: Array<{ level: 'info' | 'warning'; content: string }>;
}

interface ParsedReasonixSlashCommand {
  command: SlashCommand;
  args: string;
}

type ReasonixMemoryStoreHandle = Pick<import('reasonix').MemoryStore, 'delete'>;

export class ReasonixChatRuntime implements ChatRuntime {
  readonly providerId = PROVIDER_ID;

  private plugin!: ClaudianPlugin;
  private client: DeepSeekClient | null = null;
  private prefix: ImmutablePrefix | null = null;
  private tools: ToolRegistry | null = null;
  private loop: CacheFirstLoop | null = null;
  private currentSystemPrompt = '';
  private sessionId: string | null = null;
  private currentConversationState: ChatRuntimeConversationState | null = null;
  private pendingHydrationMessages: ChatMessage[] | null = null;
  private loopHydrated = false;
  private sessionInvalidated = false;
  private cancelled = false;
  private turnMetadata: ChatTurnMetadata = {};
  private readyListeners = new Set<(ready: boolean) => void>();
  private activeMcpBridge: ActiveMcpBridge | null = null;

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
    const settings = this.getSettings();
    const memoryRoot = settings.projectMemoryRoot.trim() || vaultPath;

    return buildSystemPrompt({
      vaultPath,
      userName: pluginSettings?.userName,
      mediaFolder: pluginSettings?.mediaFolder,
      customPrompt: pluginSettings?.systemPrompt,
      memoryEnabled: settings.memoryEnabled,
      memoryProjectRoot: memoryRoot,
      memoryHomeDir: settings.memoryHomeDir.trim() || undefined,
    });
  }

  private ensureSystemPrompt(): string {
    const nextPrompt = this.buildSystemPromptText();
    this.currentSystemPrompt = nextPrompt;
    return nextPrompt;
  }

  private ensureSessionId(): string {
    if (!this.sessionId) {
      this.sessionId = this.currentConversationState?.sessionId
        ?? `reasonix-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
    return this.sessionId;
  }

  private buildToolRegistry(): ToolRegistry {
    const registry = new ToolRegistry();
    registerPlanTool(registry);
    registerChoiceTool(registry);
    registerTodoTool(registry);
    return registry;
  }

  private parseReasonixSlashCommand(text: string): ParsedReasonixSlashCommand | null {
    const match = /^\/([a-zA-Z0-9_-]+)(?:\s+([\s\S]*))?$/.exec(text.trim());
    if (!match) {
      return null;
    }

    const name = match[1].toLowerCase();
    const command = REASONIX_STATIC_COMMANDS.find(
      (entry) => entry.name.toLowerCase() === name,
    );
    if (!command) {
      return null;
    }

    return {
      command,
      args: match[2]?.trim() ?? '',
    };
  }

  private applySlashCommandTemplate(command: SlashCommand, args: string): string {
    const content = command.content || args;
    if (content.includes('$ARGUMENTS')) {
      return content.replace(/\$ARGUMENTS/g, args || '(no explicit argument provided)');
    }
    return args ? `${content}\n\n${args}` : content;
  }

  private getMcpServerManager() {
    return ProviderWorkspaceRegistry.getMcpServerManager(this.providerId);
  }

  private toolSpecFor(name: string): ToolSpec | null {
    return this.tools?.specs().find((spec) => spec.function.name === name) ?? null;
  }

  private mcpBridgeKeyFor(enabledServerNames?: Set<string>): string {
    if (!enabledServerNames || enabledServerNames.size === 0) {
      return '';
    }
    return [...enabledServerNames].sort().join('\u001f');
  }

  private mergeMcpServerNames(
    ...sets: Array<Set<string> | undefined>
  ): Set<string> | undefined {
    const merged = new Set<string>();
    for (const set of sets) {
      for (const value of (set ?? [])) {
        merged.add(value);
      }
    }
    return merged.size > 0 ? merged : undefined;
  }

  private activeMcpBridgeIsRegistered(): boolean {
    const active = this.activeMcpBridge;
    if (!active || !this.tools || !this.prefix) {
      return false;
    }
    return active.toolNames.every((name) => this.tools?.has(name));
  }

  private async clearMcpBridge(): Promise<void> {
    const active = this.activeMcpBridge;
    if (!active) {
      return;
    }

    for (const toolName of active.toolNames) {
      this.prefix?.removeTool(toolName);
      this.tools?.unregister(toolName);
    }

    await Promise.allSettled(active.clients.map((client) => client.close()));
    this.activeMcpBridge = null;
  }

  private createMcpClient(server: ManagedMcpServer): McpClient {
    const config = server.config;
    let transport: StdioTransport | SseTransport | StreamableHttpTransport;

    if ('command' in config) {
      transport = new StdioTransport({
        command: config.command,
        args: config.args,
        env: config.env,
      });
    } else if (config.type === 'sse') {
      transport = new SseTransport({
        url: config.url,
        headers: config.headers,
      });
    } else {
      transport = new StreamableHttpTransport({
        url: config.url,
        headers: config.headers,
      });
    }

    return new McpClient({
      transport,
      workspaceDir: this.vaultPath(),
    });
  }

  private async configureMcpBridge(
    enabledServerNames?: Set<string>,
  ): Promise<McpBridgeConfigurationResult> {
    const desiredKey = this.mcpBridgeKeyFor(enabledServerNames);

    if (
      this.activeMcpBridge?.key === desiredKey
      && this.activeMcpBridgeIsRegistered()
    ) {
      return { changed: false, notices: [] };
    }

    const hadActiveBridge = this.activeMcpBridge !== null;
    await this.clearMcpBridge();

    if (!enabledServerNames || enabledServerNames.size === 0 || !this.tools || !this.prefix) {
      return { changed: hadActiveBridge, notices: [] };
    }

    const manager = this.getMcpServerManager();
    if (!manager) {
      return {
        changed: hadActiveBridge,
        notices: [{
          level: 'warning',
          content: 'MCP is enabled for this turn, but no MCP server manager is available.',
        }],
      };
    }

    const allServers = manager.getServers();
    const selectedServers = allServers.filter(
      (server) => server.enabled && enabledServerNames.has(server.name),
    );
    const missingServers = [...enabledServerNames].filter(
      (name) => !selectedServers.some((server) => server.name === name),
    );

    const notices: Array<{ level: 'info' | 'warning'; content: string }> = [];
    if (missingServers.length > 0) {
      notices.push({
        level: 'warning',
        content: `Skipped unavailable MCP server${missingServers.length > 1 ? 's' : ''}: ${missingServers.join(', ')}`,
      });
    }

    if (selectedServers.length === 0) {
      return { changed: hadActiveBridge, notices };
    }

    const clients: McpClient[] = [];
    const toolNames: string[] = [];

    for (const server of selectedServers) {
      const client = this.createMcpClient(server);
      try {
        await client.initialize();
        const bridge = await bridgeMcpTools(client, {
          registry: this.tools,
          namePrefix: `mcp__${server.name}__`,
          serverName: server.name,
        });

        const disabledNames = new Set(
          (server.disabledTools ?? []).map((tool) => `mcp__${server.name}__${tool}`),
        );

        for (const registeredName of bridge.registeredNames) {
          if (disabledNames.has(registeredName)) {
            this.tools.unregister(registeredName);
            continue;
          }

          const spec = this.toolSpecFor(registeredName);
          if (spec) {
            this.prefix.addTool(spec);
            toolNames.push(registeredName);
          }
        }

        clients.push(client);
      } catch (error) {
        await client.close().catch(() => {});
        notices.push({
          level: 'warning',
          content: `Failed to connect MCP server "${server.name}": ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    if (clients.length > 0) {
      this.activeMcpBridge = { clients, toolNames, key: desiredKey };
      notices.unshift({
        level: 'info',
        content: `Enabled ${toolNames.length} MCP tool${toolNames.length === 1 ? '' : 's'} from ${clients.length} server${clients.length === 1 ? '' : 's'}.`,
      });
    }

    return { changed: true, notices };
  }

  private buildConfirmationGate(): LoopConfirmationGate {
    return {
      ask: async ({ kind, payload }) => {
        switch (kind) {
          case 'choice':
            return await this.handleChoicePause(payload as {
              question: string;
              options: Array<{ id: string; title: string; summary?: string }>;
              allowCustom: boolean;
            });
          case 'plan_proposed':
            return await this.handlePlanProposalPause(payload as {
              plan: string;
              summary?: string;
            });
          case 'plan_checkpoint':
            return await this.handlePlanCheckpointPause(payload as {
              stepId: string;
              title?: string;
              result: string;
            });
          case 'plan_revision':
            return await this.handlePlanRevisionPause(payload as {
              reason: string;
              summary?: string;
            });
          case 'run_command':
          case 'run_background':
          case 'path_access':
            return { type: 'deny' };
          default:
            return { type: 'cancel' };
        }
      },
    } as LoopConfirmationGate;
  }

  private ensureTooling(): void {
    const systemPrompt = this.ensureSystemPrompt();

    if (!this.tools) {
      this.tools = this.buildToolRegistry();
    }

    if (!this.prefix) {
      this.prefix = new ImmutablePrefix({
        system: systemPrompt,
        toolSpecs: this.tools.specs(),
      });
    } else {
      this.prefix.replaceSystem(systemPrompt);
    }
  }

  private ensureLoop(forceColdStart = false, modelOverride?: string): CacheFirstLoop {
    const settings = this.getSettings();

    if (forceColdStart) {
      this.loop = null;
      this.loopHydrated = false;
    }

    this.ensureTooling();
    const targetModel = modelOverride || settings.model || DEFAULT_MODEL;
    const prefix = this.prefix;
    const tools = this.tools;
    if (!prefix || !tools) {
      throw new Error('Reasonix runtime tooling is not initialized.');
    }

    if (!this.loop) {
      this.loop = new CacheFirstLoop({
        client: this.ensureClient(),
        prefix,
        tools,
        model: targetModel,
        stream: true,
        reasoningEffort: settings.reasoningEffort,
        maxOutputTokens: settings.maxOutputTokens || undefined,
        budgetUsd: settings.budgetUsd ?? undefined,
        maxIterPerTurn: settings.maxIterPerTurn,
        confirmationGate: this.buildConfirmationGate(),
        rebuildSystem: () => this.buildSystemPromptText(),
      });
      this.loopHydrated = false;
    } else {
      this.loop.configure({
        model: targetModel,
        stream: true,
        reasoningEffort: settings.reasoningEffort,
        maxOutputTokens: settings.maxOutputTokens || null,
      });
      this.loop.setBudget(settings.budgetUsd ?? null);
    }

    return this.loop;
  }

  private recreateLoopPreservingHistory(modelOverride?: string): CacheFirstLoop {
    const previousMessages = this.loop?.log.toFullHistory() ?? [];
    this.loop = null;
    this.loopHydrated = false;

    const loop = this.ensureLoop(false, modelOverride);
    if (previousMessages.length > 0) {
      loop.log.initWindow(previousMessages);
      this.loopHydrated = true;
      this.pendingHydrationMessages = null;
    }
    return loop;
  }

  private syncLoopHistory(conversationHistory?: ChatMessage[]): void {
    if (!this.loop || this.loopHydrated) {
      return;
    }

    const sourceMessages = this.pendingHydrationMessages ?? conversationHistory ?? [];
    const hydrated = this.mapConversationToLoopMessages(sourceMessages);
    this.loop.log.initWindow(hydrated);
    this.loopHydrated = true;
    this.pendingHydrationMessages = null;
  }

  private mapConversationToLoopMessages(messages: ChatMessage[]): ReasonixChatMessage[] {
    const mapped: ReasonixChatMessage[] = [];

    for (const message of messages) {
      if (message.role === 'user') {
        mapped.push({
          role: 'user',
          content: message.content,
        });
        continue;
      }

      const toolCalls = message.toolCalls ?? [];
      if (toolCalls.length === 0) {
        mapped.push({
          role: 'assistant',
          content: message.content,
        });
        continue;
      }

      mapped.push({
        role: 'assistant',
        content: message.content || '',
        tool_calls: toolCalls.map((toolCall) => ({
          id: toolCall.id,
          type: 'function',
          function: {
            name: this.denormalizeToolName(toolCall.name),
            arguments: JSON.stringify(
              this.denormalizeToolInput(toolCall.name, toolCall.input),
            ),
          },
        })),
      });

      for (const toolCall of toolCalls) {
        mapped.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: this.denormalizeToolName(toolCall.name),
          content: toolCall.result ?? '',
        });
      }
    }

    return mapped;
  }

  private denormalizeToolName(name: string): string {
    switch (name) {
      case TOOL_TODO_WRITE:
        return 'todo_write';
      case TOOL_ASK_USER_QUESTION:
        return 'ask_choice';
      default:
        return name;
    }
  }

  private denormalizeToolInput(
    name: string,
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    if (name !== TOOL_ASK_USER_QUESTION) {
      return input;
    }

    const questions = Array.isArray(input.questions)
      ? input.questions as Array<Record<string, unknown>>
      : [];
    const first = questions[0];
    const options = Array.isArray(first?.options)
      ? (first.options as Array<Record<string, unknown>>).map((option, index) => ({
          id: typeof option.value === 'string'
            ? option.value
            : typeof option.label === 'string'
              ? option.label
              : `option-${index + 1}`,
          title: typeof option.label === 'string' ? option.label : `Option ${index + 1}`,
          summary: typeof option.description === 'string' && option.description.length > 0
            ? option.description
            : undefined,
        }))
      : [];

    return {
      question: typeof first?.question === 'string' ? first.question : 'Choose an option',
      options,
      allowCustom: first?.isOther === true,
    };
  }

  private normalizeToolUse(event: LoopEvent): NormalizedToolUse {
    const toolName = event.toolName ?? 'tool';
    const parsedInput = this.parseToolArgs(event.toolArgs);

    if (toolName === 'todo_write') {
      return {
        name: TOOL_TODO_WRITE,
        input: parsedInput,
        interactive: false,
      };
    }

    if (toolName === 'ask_choice') {
      const options = Array.isArray(parsedInput.options)
        ? parsedInput.options
            .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
            .map((entry, index) => ({
              label: typeof entry.title === 'string' ? entry.title : `Option ${index + 1}`,
              description: typeof entry.summary === 'string' ? entry.summary : '',
              value: typeof entry.id === 'string' ? entry.id : `option-${index + 1}`,
            }))
        : [];

      return {
        name: TOOL_ASK_USER_QUESTION,
        input: {
          questions: [{
            id: 'choice',
            header: 'Choice',
            question: typeof parsedInput.question === 'string'
              ? parsedInput.question
              : 'Choose an option',
            options,
            multiSelect: false,
            isOther: parsedInput.allowCustom === true,
          }],
        },
        interactive: true,
      };
    }

    return {
      name: toolName,
      input: parsedInput,
      interactive: this.isInteractiveReasonixTool(toolName),
    };
  }

  private isInteractiveReasonixTool(name: string): boolean {
    return (
      name === 'ask_choice'
      || name === 'submit_plan'
      || name === 'mark_step_complete'
      || name === 'revise_plan'
    );
  }

  private parseToolArgs(raw: string | undefined): Record<string, unknown> {
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Keep raw payload visible if it is incomplete JSON.
    }

    return { _raw: raw };
  }

  private buildUsageInfo(
    model: string | undefined,
    usage: {
      promptTokens: number;
      promptCacheHitTokens: number;
      promptCacheMissTokens: number;
    },
  ): UsageInfo {
    const contextWindow = this.resolveContextWindow(model);
    const contextTokens = usage.promptTokens;

    return {
      model,
      inputTokens: usage.promptTokens,
      cacheCreationInputTokens: usage.promptCacheMissTokens,
      cacheReadInputTokens: usage.promptCacheHitTokens,
      contextWindow,
      contextWindowIsAuthoritative: true,
      contextTokens,
      percentage: Math.min(100, Math.round((contextTokens / contextWindow) * 100)),
    };
  }

  private resolveContextWindow(model?: string): number {
    if (!model) {
      return DEFAULT_CONTEXT_WINDOW;
    }
    if (
      model.startsWith('deepseek-v4')
      || model === 'deepseek-chat'
      || model === 'deepseek-reasoner'
    ) {
      return DEFAULT_CONTEXT_WINDOW;
    }
    return FALLBACK_CONTEXT_WINDOW;
  }

  private extractChoiceToolUseResult(content: string): { answers: Record<string, string> } | undefined {
    const picked = /^user picked:\s*(.+)$/i.exec(content);
    if (picked?.[1]) {
      return { answers: { choice: picked[1].trim() } };
    }

    const answered = /^user answered:\s*(.+)$/i.exec(content);
    if (answered?.[1]) {
      return { answers: { choice: answered[1].trim() } };
    }

    return undefined;
  }

  private async askSingleQuestion(input: {
    id: string;
    header: string;
    question: string;
    options: Array<{ label: string; description: string; value: string }>;
    allowCustom?: boolean;
  }): Promise<string | null> {
    if (!this.askUserQuestionCallback) {
      return null;
    }

    const answers = await this.askUserQuestionCallback({
      questions: [{
        id: input.id,
        header: input.header,
        question: input.question,
        options: input.options,
        multiSelect: false,
        isOther: input.allowCustom === true,
      }],
    });

    if (!answers) {
      return null;
    }

    const value = answers[input.id] ?? answers[input.question];
    if (Array.isArray(value)) {
      return typeof value[0] === 'string' ? value[0] : null;
    }
    return typeof value === 'string' ? value : null;
  }

  private async handleChoicePause(payload: {
    question: string;
    options: Array<{ id: string; title: string; summary?: string }>;
    allowCustom: boolean;
  }): Promise<{ type: 'pick'; optionId: string } | { type: 'text'; text: string } | { type: 'cancel' }> {
    const answer = await this.askSingleQuestion({
      id: 'choice',
      header: 'Choice',
      question: payload.question,
      options: payload.options.map((option) => ({
        label: option.title,
        description: option.summary ?? '',
        value: option.id,
      })),
      allowCustom: payload.allowCustom,
    });

    if (!answer) {
      return { type: 'cancel' };
    }

    if (payload.options.some((option) => option.id === answer)) {
      return { type: 'pick', optionId: answer };
    }

    return { type: 'text', text: answer };
  }

  private async handlePlanProposalPause(payload: {
    plan: string;
    summary?: string;
  }): Promise<{ type: 'approve'; feedback?: string } | { type: 'refine'; feedback?: string } | { type: 'cancel'; feedback?: string }> {
    const summary = payload.summary?.trim()
      || payload.plan.split('\n').find((line) => line.trim().length > 0)
      || 'Review this plan';
    const answer = await this.askSingleQuestion({
      id: 'plan_review',
      header: 'Plan',
      question: summary,
      options: [
        { label: 'Approve', description: 'Accept this plan and continue.', value: 'approve' },
        { label: 'Cancel', description: 'Stop here and leave planning active.', value: 'cancel' },
      ],
      allowCustom: true,
    });

    if (!answer) {
      return { type: 'cancel' };
    }
    if (answer === 'approve') {
      return { type: 'approve' };
    }
    if (answer === 'cancel') {
      return { type: 'cancel' };
    }
    return { type: 'refine', feedback: answer };
  }

  private async handlePlanCheckpointPause(payload: {
    stepId: string;
    title?: string;
    result: string;
  }): Promise<{ type: 'continue' } | { type: 'revise'; feedback?: string } | { type: 'stop' }> {
    const label = payload.title?.trim() || payload.stepId;
    const answer = await this.askSingleQuestion({
      id: 'plan_checkpoint',
      header: 'Step',
      question: `${label}: ${payload.result}`,
      options: [
        { label: 'Continue', description: 'Move to the next step.', value: 'continue' },
        { label: 'Stop', description: 'End here.', value: 'stop' },
      ],
      allowCustom: true,
    });

    if (!answer) {
      return { type: 'stop' };
    }
    if (answer === 'continue') {
      return { type: 'continue' };
    }
    if (answer === 'stop') {
      return { type: 'stop' };
    }
    return { type: 'revise', feedback: answer };
  }

  private async handlePlanRevisionPause(payload: {
    reason: string;
    summary?: string;
  }): Promise<{ type: 'accepted' } | { type: 'rejected' } | { type: 'cancelled' }> {
    const question = payload.summary?.trim() || payload.reason || 'Review this plan revision';
    const answer = await this.askSingleQuestion({
      id: 'plan_revision',
      header: 'Revision',
      question,
      options: [
        { label: 'Accept', description: 'Use the revised remaining steps.', value: 'accept' },
        { label: 'Cancel', description: 'Stop and keep current state.', value: 'cancel' },
      ],
      allowCustom: true,
    });

    if (!answer) {
      return { type: 'cancelled' };
    }
    if (answer === 'accept') {
      return { type: 'accepted' };
    }
    if (answer === 'cancel') {
      return { type: 'cancelled' };
    }
    return { type: 'rejected' };
  }

  private looksLikeCompactionWarning(event: LoopEvent): boolean {
    if (event.role !== 'warning') {
      return false;
    }
    return /folded|compacted/i.test(event.content);
  }

  private buildHelpText(): string {
    const commands = REASONIX_STATIC_COMMANDS
      .map((command) => `/${command.name}${command.argumentHint ? ` ${command.argumentHint}` : ''} - ${command.description ?? 'Reasonix command'}`)
      .join('\n');
    return `Supported Reasonix commands in Obsidian:\n\n${commands}`;
  }

  private buildStatusText(): string {
    const settings = this.getSettings();
    const activeMcp = this.activeMcpBridge?.key
      ? this.activeMcpBridge.key.split('\u001f').filter(Boolean).join(', ')
      : 'none';

    return [
      'Reasonix runtime status:',
      '',
      `- model: ${settings.model || DEFAULT_MODEL}`,
      `- reasoning effort: ${settings.reasoningEffort}`,
      `- session: ${this.sessionId ?? 'not started'}`,
      `- ready: ${this.isReady() ? 'yes' : 'no API key configured'}`,
      `- MCP servers: ${activeMcp}`,
      `- memory: ${settings.memoryEnabled ? 'enabled' : 'disabled'}`,
    ].join('\n');
  }

  private buildContextText(): string {
    const currentTokens = this.loop?.getCurrentLogTokens() ?? 0;
    const settings = this.getSettings();
    const contextWindow = this.resolveContextWindow(settings.model || DEFAULT_MODEL);
    const percent = Math.min(100, Math.round((currentTokens / contextWindow) * 100));

    return [
      'Reasonix context:',
      '',
      `- conversation log tokens: ${currentTokens.toLocaleString()}`,
      `- context window: ${contextWindow.toLocaleString()}`,
      `- used: ${percent}%`,
      `- tool schemas: ${this.prefix?.toolSpecs.length ?? 0}`,
    ].join('\n');
  }

  private buildMcpText(): string {
    const manager = this.getMcpServerManager();
    const servers = manager?.getServers() ?? [];

    if (servers.length === 0) {
      return 'No MCP servers are configured for Reasonix yet.';
    }

    const activeNames = new Set(
      this.activeMcpBridge?.key
        ? this.activeMcpBridge.key.split('\u001f').filter(Boolean)
        : [],
    );

    return [
      'Reasonix MCP servers:',
      '',
      ...servers.map((server) => {
        const state = server.enabled
          ? activeNames.has(server.name)
            ? 'active'
            : 'available'
          : 'disabled';
        const contextSaving = server.contextSaving ? ', context-saving' : '';
        const disabledTools = server.disabledTools?.length
          ? `, ${server.disabledTools.length} disabled tool(s)`
          : '';
        return `- ${server.name}: ${state}${contextSaving}${disabledTools}`;
      }),
    ].join('\n');
  }

  private buildMemoryText(args = ''): string {
    const settings = this.getSettings();
    const projectRoot = settings.projectMemoryRoot.trim() || this.vaultPath();
    const memoryHomeDir = settings.memoryHomeDir.trim() || undefined;
    const memoryHomeLabel = memoryHomeDir || '~/.reasonix';
    const normalizedArgs = args.trim();

    if (!settings.memoryEnabled) {
      return [
        'Reasonix memory is disabled in Reasonian settings.',
        '',
        `- project memory root: ${projectRoot}`,
        `- Reasonix home: ${memoryHomeLabel}`,
      ].join('\n');
    }

    try {
      const {
        MemoryStore,
        memoryEnabled,
        readProjectMemory,
      } = require('reasonix') as typeof import('reasonix');

      if (!memoryEnabled()) {
        return [
          'Reasonix memory is disabled by the REASONIX_MEMORY environment variable.',
          '',
          `- project memory root: ${projectRoot}`,
          `- Reasonix home: ${memoryHomeLabel}`,
        ].join('\n');
      }

      const projectMemory = readProjectMemory(projectRoot);
      const store = new MemoryStore({
        homeDir: memoryHomeDir,
        projectRoot,
      });
      const entries = store.list();
      const globalCount = entries.filter((entry) => entry.scope === 'global').length;
      const projectCount = entries.filter((entry) => entry.scope === 'project').length;
      const globalIndex = store.loadIndex('global');
      const projectIndex = store.loadIndex('project');

      if (normalizedArgs) {
        return this.buildMemoryCommandText(normalizedArgs, entries, store);
      }

      return [
        'Reasonix memory status:',
        '',
        `- project memory root: ${projectRoot}`,
        `- Reasonix home: ${memoryHomeLabel}`,
        `- project memory file: ${projectMemory ? projectMemory.path : 'not found'}`,
        projectMemory
          ? `- project memory chars: ${projectMemory.originalChars.toLocaleString()}${projectMemory.truncated ? ' (truncated)' : ''}`
          : '- project memory chars: 0',
        `- global memory entries: ${globalCount}`,
        `- project memory entries: ${projectCount}`,
        `- global MEMORY.md: ${globalIndex ? `${globalIndex.originalChars.toLocaleString()} chars${globalIndex.truncated ? ' (truncated)' : ''}` : 'not found'}`,
        `- project MEMORY.md: ${projectIndex ? `${projectIndex.originalChars.toLocaleString()} chars${projectIndex.truncated ? ' (truncated)' : ''}` : 'not found'}`,
      ].join('\n');
    } catch (error) {
      return `Reasonix memory status is unavailable: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private buildMemoryCommandText(
    args: string,
    entries: MemoryEntry[],
    store: ReasonixMemoryStoreHandle,
  ): string {
    const [subcommandRaw, ...rest] = args.split(/\s+/);
    const subcommand = subcommandRaw?.toLowerCase();

    switch (subcommand) {
      case 'status':
        return this.buildMemoryText();
      case 'list':
        return this.buildMemoryListText(rest[0], entries);
      case 'show':
        return this.buildMemoryShowText(rest.join(' '), entries);
      case 'forget':
        return this.buildMemoryForgetText(rest.join(' '), entries, store);
      default:
        return 'Usage: /memory [status|list [global|project]|show <name|scope/name>|forget <name|scope/name> confirm]';
    }
  }

  private buildMemoryListText(scopeArg: string | undefined, entries: MemoryEntry[]): string {
    const scope = scopeArg?.toLowerCase();
    if (scope && scope !== 'global' && scope !== 'project') {
      return 'Usage: /memory list [global|project]';
    }

    const filtered = scope
      ? entries.filter((entry) => entry.scope === scope)
      : entries;

    if (filtered.length === 0) {
      return scope
        ? `No ${scope} Reasonix memory entries found.`
        : 'No Reasonix memory entries found.';
    }

    const lines = filtered
      .sort((a, b) => `${a.scope}/${a.name}`.localeCompare(`${b.scope}/${b.name}`))
      .map((entry) => {
        const priority = entry.priority ? `, priority=${entry.priority}` : '';
        const type = entry.type ? `, type=${entry.type}` : '';
        return `- ${entry.scope}/${entry.name}${type}${priority}: ${entry.description || '(no description)'}`;
      });

    return [
      `Reasonix memory entries (${filtered.length}):`,
      '',
      ...lines,
      '',
      'Read one entry with /memory show <name> or /memory show <scope/name>.',
    ].join('\n');
  }

  private buildMemoryShowText(target: string, entries: MemoryEntry[]): string {
    const resolved = this.resolveMemoryTarget(target, entries);
    if (resolved.kind === 'usage') {
      return 'Usage: /memory show <name|scope/name>';
    }
    if (resolved.kind === 'invalid-scope') {
      return 'Usage: /memory show <name|scope/name>';
    }
    if (resolved.matches.length === 0) {
      return `No Reasonix memory entry found for "${resolved.target}".`;
    }
    if (resolved.matches.length > 1) {
      return `Multiple entries match "${resolved.target}". Use /memory show global/${resolved.name} or /memory show project/${resolved.name}.`;
    }

    const entry = resolved.matches[0];
    const body = entry.body.length > 6000
      ? `${entry.body.slice(0, 6000)}\n\n[truncated ${entry.body.length - 6000} chars]`
      : entry.body;

    return [
      `Reasonix memory: ${entry.scope}/${entry.name}`,
      '',
      `- type: ${entry.type}`,
      `- description: ${entry.description || '(none)'}`,
      `- created: ${entry.createdAt || '(unknown)'}`,
      entry.priority ? `- priority: ${entry.priority}` : '',
      entry.expires ? `- expires: ${entry.expires}` : '',
      '',
      body || '(empty)',
    ].filter((line) => line !== '').join('\n');
  }

  private buildMemoryForgetText(
    rawArgs: string,
    entries: MemoryEntry[],
    store: ReasonixMemoryStoreHandle,
  ): string {
    const parts = rawArgs.trim().split(/\s+/).filter(Boolean);
    const hasConfirm = parts[parts.length - 1]?.toLowerCase() === 'confirm';
    const target = hasConfirm ? parts.slice(0, -1).join(' ') : parts.join(' ');
    const resolved = this.resolveMemoryTarget(target, entries);

    if (resolved.kind === 'usage' || resolved.kind === 'invalid-scope') {
      return 'Usage: /memory forget <name|scope/name> confirm';
    }
    if (resolved.matches.length === 0) {
      return `No Reasonix memory entry found for "${resolved.target}".`;
    }
    if (resolved.matches.length > 1) {
      return `Multiple entries match "${resolved.target}". Use /memory forget global/${resolved.name} confirm or /memory forget project/${resolved.name} confirm.`;
    }

    const entry = resolved.matches[0];
    if (!hasConfirm) {
      return [
        `This would delete Reasonix memory ${entry.scope}/${entry.name}.`,
        '',
        'Run the command again with confirm to delete it:',
        `/memory forget ${entry.scope}/${entry.name} confirm`,
      ].join('\n');
    }

    const deleted = store.delete(entry.scope, entry.name);
    return deleted
      ? `Deleted Reasonix memory ${entry.scope}/${entry.name}.`
      : `Reasonix memory ${entry.scope}/${entry.name} was not found at delete time.`;
  }

  private resolveMemoryTarget(
    target: string,
    entries: MemoryEntry[],
  ): (
    | { kind: 'usage' }
    | { kind: 'invalid-scope' }
    | {
        kind: 'resolved';
        target: string;
        name: string;
        scope?: MemoryScope;
        matches: MemoryEntry[];
      }
  ) {
    const normalized = target.trim();
    if (!normalized) {
      return { kind: 'usage' };
    }

    const [scopePart, namePart] = normalized.includes('/')
      ? normalized.split('/', 2)
      : [undefined, normalized];
    const scope = scopePart?.toLowerCase();
    if (scope && scope !== 'global' && scope !== 'project') {
      return { kind: 'invalid-scope' };
    }

    const matches = entries.filter((entry) => {
      if (scope && entry.scope !== scope) {
        return false;
      }
      return entry.name.toLowerCase() === namePart.toLowerCase();
    });

    return {
      kind: 'resolved',
      target: normalized,
      name: namePart,
      scope: scope as MemoryScope | undefined,
      matches,
    };
  }

  private normalizeModelId(input: string): string {
    switch (input.trim().toLowerCase()) {
      case 'flash':
        return 'deepseek-v4-flash';
      case 'pro':
        return 'deepseek-v4-pro';
      default:
        return input.trim();
    }
  }

  private async saveReasonixSettings(
    updates: Partial<ReasonixProviderSettings>,
  ): Promise<ReasonixProviderSettings> {
    const next = updateReasonixProviderSettings(
      this.plugin.settings as unknown as Record<string, unknown>,
      updates,
    );
    await this.plugin.saveSettings();

    this.loop?.configure({
      model: next.model || DEFAULT_MODEL,
      reasoningEffort: next.reasoningEffort,
      maxOutputTokens: next.maxOutputTokens > 0 ? next.maxOutputTokens : null,
    });
    this.loop?.setBudget(next.budgetUsd ?? null);

    return next;
  }

  private async handleModelCommand(args: string): Promise<string> {
    const current = this.getSettings().model || DEFAULT_MODEL;
    if (!args) {
      return `Current Reasonix model: ${current}`;
    }

    const model = this.normalizeModelId(args);
    if (!model) {
      return 'Usage: /model [flash|pro|model-id]';
    }

    const next = await this.saveReasonixSettings({
      model,
      lastModel: model,
    });
    return `Reasonix model switched to ${next.model}.`;
  }

  private async handleEffortCommand(args: string): Promise<string> {
    const current = this.getSettings().reasoningEffort;
    if (!args) {
      return `Current Reasonix reasoning effort: ${current}`;
    }

    const effort = args.trim().toLowerCase();
    if (!['low', 'medium', 'high', 'max'].includes(effort)) {
      return 'Usage: /effort [low|medium|high|max]';
    }

    const next = await this.saveReasonixSettings({
      reasoningEffort: effort as ReasonixProviderSettings['reasoningEffort'],
    });
    return `Reasonix reasoning effort switched to ${next.reasoningEffort}.`;
  }

  private async handleMaxTokensCommand(args: string): Promise<string> {
    const current = this.getSettings().maxOutputTokens;
    if (!args) {
      return current > 0
        ? `Current Reasonix max output tokens: ${current}`
        : 'Reasonix max output tokens are not capped.';
    }

    const normalized = args.trim().toLowerCase();
    if (normalized === 'off' || normalized === '0') {
      await this.saveReasonixSettings({ maxOutputTokens: 0 });
      return 'Reasonix max output token cap cleared.';
    }

    const value = Number.parseInt(normalized, 10);
    if (!Number.isFinite(value) || value <= 0 || String(value) !== normalized) {
      return 'Usage: /max-tokens [positive-integer|off]';
    }

    const next = await this.saveReasonixSettings({ maxOutputTokens: value });
    return `Reasonix max output tokens set to ${next.maxOutputTokens}.`;
  }

  private async handleBudgetCommand(args: string): Promise<string> {
    const current = this.getSettings().budgetUsd;
    if (!args) {
      return current && current > 0
        ? `Current Reasonix budget cap: $${current}`
        : 'Reasonix budget cap is off.';
    }

    const normalized = args.trim().toLowerCase();
    if (normalized === 'off' || normalized === '0') {
      await this.saveReasonixSettings({ budgetUsd: null });
      return 'Reasonix budget cap cleared.';
    }

    const value = Number(normalized);
    if (!Number.isFinite(value) || value <= 0) {
      return 'Usage: /budget [usd|off]';
    }

    const next = await this.saveReasonixSettings({ budgetUsd: value });
    return `Reasonix budget cap set to $${next.budgetUsd}.`;
  }

  private async compactCurrentHistory(
    conversationHistory?: ChatMessage[],
    modelOverride?: string,
  ): Promise<{ content: string; compacted: boolean }> {
    const loop = this.ensureLoop(false, modelOverride);
    this.ensureSessionId();
    if (!this.loopHydrated) {
      this.pendingHydrationMessages = conversationHistory ?? [];
    }
    this.syncLoopHistory(conversationHistory);

    const result = await loop.compactHistory();
    if (!result.folded) {
      return {
        content: 'Nothing to compact yet. The current conversation is already within the active Reasonix window.',
        compacted: false,
      };
    }

    return {
      content: [
        'Compacted Reasonix conversation history.',
        '',
        `- messages before: ${result.beforeMessages}`,
        `- messages after: ${result.afterMessages}`,
        `- summary characters: ${result.summaryChars}`,
      ].join('\n'),
      compacted: true,
    };
  }

  private async runLocalSlashCommand(
    parsed: ParsedReasonixSlashCommand,
    conversationHistory: ChatMessage[] | undefined,
    queryOptions: ChatRuntimeQueryOptions | undefined,
  ): Promise<{ content: string; compacted?: boolean } | null> {
    if (parsed.command.disableModelInvocation !== true) {
      return null;
    }

    switch (parsed.command.name) {
      case 'compact':
        return await this.compactCurrentHistory(conversationHistory, queryOptions?.model);
      case 'status':
        return { content: this.buildStatusText() };
      case 'context':
        return { content: this.buildContextText() };
      case 'mcp':
        return { content: this.buildMcpText() };
      case 'memory':
        return { content: this.buildMemoryText(parsed.args) };
      case 'help':
        return { content: this.buildHelpText() };
      case 'model':
        return { content: await this.handleModelCommand(parsed.args) };
      case 'effort':
        return { content: await this.handleEffortCommand(parsed.args) };
      case 'max-tokens':
        return { content: await this.handleMaxTokensCommand(parsed.args) };
      case 'budget':
        return { content: await this.handleBudgetCommand(parsed.args) };
      default:
        return null;
    }
  }

  getCapabilities(): Readonly<ProviderCapabilities> {
    return REASONIX_PROVIDER_CAPABILITIES;
  }

  prepareTurn(request: ChatTurnRequest): PreparedChatTurn {
    const manager = this.getMcpServerManager();
    const mcpMentions = manager?.extractMentions(request.text) ?? new Set<string>();
    const parsedCommand = this.parseReasonixSlashCommand(request.text);
    const persistedContent = parsedCommand && parsedCommand.command.disableModelInvocation !== true
      ? this.applySlashCommandTemplate(parsedCommand.command, parsedCommand.args)
      : request.text;

    return {
      request,
      persistedContent,
      prompt: this.currentSystemPrompt || this.buildSystemPromptText(),
      isCompact: parsedCommand?.command.name === 'compact',
      mcpMentions,
    };
  }

  onReadyStateChange(listener: (ready: boolean) => void): () => void {
    this.readyListeners.add(listener);
    listener(this.isReady());
    return () => {
      this.readyListeners.delete(listener);
    };
  }

  setResumeCheckpoint(_checkpointId: string | undefined): void {}

  syncConversationState(
    conversation: ChatRuntimeConversationState | null,
    _externalContextPaths?: string[],
  ): void {
    const nextSessionId = conversation?.sessionId ?? null;
    const sessionChanged = nextSessionId !== this.sessionId;

    this.currentConversationState = conversation;
    this.sessionId = nextSessionId;

    if (sessionChanged) {
      this.loop = null;
      this.prefix = null;
      this.tools = null;
      this.pendingHydrationMessages = null;
      this.loopHydrated = false;
      this.sessionInvalidated = false;
      void this.clearMcpBridge();
    }
  }

  async reloadMcpServers(): Promise<void> {
    await this.getMcpServerManager()?.loadServers();
    await this.clearMcpBridge();
  }

  async ensureReady(options?: ChatRuntimeEnsureReadyOptions): Promise<boolean> {
    try {
      this.ensureLoop(options?.force === true, undefined);
      return true;
    } catch {
      return false;
    }
  }

  async *query(
    turn: PreparedChatTurn,
    conversationHistory?: ChatMessage[],
    queryOptions?: ChatRuntimeQueryOptions,
  ): AsyncGenerator<StreamChunk> {
    this.cancelled = false;
    this.turnMetadata = {};

    if (queryOptions?.forceColdStart === true) {
      await this.clearMcpBridge();
      this.loop = null;
      this.prefix = null;
      this.tools = null;
      this.loopHydrated = false;
      this.pendingHydrationMessages = null;
    }

    const parsedCommand = this.parseReasonixSlashCommand(turn.request.text);
    if (parsedCommand?.command.disableModelInvocation === true) {
      const localResult = await this.runLocalSlashCommand(
        parsedCommand,
        conversationHistory,
        queryOptions,
      );
      if (localResult) {
        yield { type: 'user_message_start', content: turn.persistedContent };
        if (localResult.compacted) {
          yield { type: 'context_compacted' };
        }
        yield { type: 'text', content: localResult.content };
        yield { type: 'done' };
        return;
      }
    }

    this.ensureTooling();
    const enabledMcpServers = this.mergeMcpServerNames(
      turn.request.enabledMcpServers,
      turn.mcpMentions,
      queryOptions?.mcpMentions,
      queryOptions?.enabledMcpServers,
    );
    const hadLoopBeforeMcpConfiguration = this.loop !== null;
    const mcpBridge = await this.configureMcpBridge(enabledMcpServers);
    const loop = hadLoopBeforeMcpConfiguration && mcpBridge.changed
      ? this.recreateLoopPreservingHistory(queryOptions?.model)
      : this.ensureLoop(false, queryOptions?.model);

    this.ensureSessionId();
    if (!this.loopHydrated) {
      this.pendingHydrationMessages = conversationHistory ?? [];
    }
    this.syncLoopHistory(conversationHistory);

    yield { type: 'user_message_start', content: turn.persistedContent };
    for (const notice of mcpBridge.notices) {
      yield {
        type: 'notice',
        content: notice.content,
        level: notice.level,
      };
    }

    let streamedAssistantText = '';
    let pendingAssistantStart = false;
    let emittedAssistantStart = false;

    try {
      for await (const event of loop.step(turn.persistedContent)) {
        if (this.cancelled) {
          loop.abort();
          break;
        }

        if (event.role === 'steer') {
          yield { type: 'user_message_start', content: event.content };
          pendingAssistantStart = true;
          emittedAssistantStart = false;
          streamedAssistantText = '';
          continue;
        }

        if (
          pendingAssistantStart
          && !emittedAssistantStart
          && (
            event.role === 'assistant_delta'
            || event.role === 'assistant_final'
            || event.role === 'tool_start'
          )
        ) {
          yield { type: 'assistant_message_start' };
          pendingAssistantStart = false;
          emittedAssistantStart = true;
        }

        switch (event.role) {
          case 'assistant_delta':
            if (event.reasoningDelta) {
              yield { type: 'thinking', content: event.reasoningDelta };
            }
            if (event.content) {
              streamedAssistantText += event.content;
              yield { type: 'text', content: event.content };
            }
            break;

          case 'assistant_final':
            if (event.content.startsWith(streamedAssistantText)) {
              const tail = event.content.slice(streamedAssistantText.length);
              if (tail) {
                yield { type: 'text', content: tail };
              }
            }
            if (event.stats) {
              yield {
                type: 'usage',
                usage: this.buildUsageInfo(event.stats.model, event.stats.usage),
                sessionId: this.sessionId,
              };
            }
            streamedAssistantText = '';
            emittedAssistantStart = false;
            break;

          case 'tool_call_delta':
            break;

          case 'tool_start': {
            const normalized = this.normalizeToolUse(event);
            yield {
              type: 'tool_use',
              id: event.callId ?? `${normalized.name}-${Date.now()}`,
              name: normalized.name,
              input: normalized.input,
            };
            if (normalized.interactive) {
              yield {
                type: 'notice',
                content: 'Waiting for your input.',
                level: 'info',
              };
            }
            break;
          }

          case 'tool': {
            const normalized = this.normalizeToolUse(event);
            const toolUseResult = normalized.name === TOOL_ASK_USER_QUESTION
              ? this.extractChoiceToolUseResult(event.content)
              : undefined;
            yield {
              type: 'tool_result',
              id: event.callId ?? `${normalized.name}-${Date.now()}`,
              content: event.content,
              isError: this.toolResultIsError(event.content),
              toolUseResult,
            };
            break;
          }

          case 'status':
            yield {
              type: 'notice',
              content: event.content,
              level: 'info',
            };
            break;

          case 'warning':
            if (this.looksLikeCompactionWarning(event)) {
              yield { type: 'context_compacted' };
            }
            yield {
              type: 'notice',
              content: event.content,
              level: 'warning',
            };
            break;

          case 'error':
            yield {
              type: 'error',
              content: event.error || event.content || 'Unknown Reasonix runtime error',
            };
            break;

          case 'done':
            yield { type: 'done' };
            break;

          default:
            break;
        }
      }
    } catch (err: unknown) {
      if (!this.cancelled) {
        const message = err instanceof Error ? err.message : String(err);
        yield { type: 'error', content: message };
      }
    }
  }

  private toolResultIsError(content: string): boolean {
    try {
      const parsed = JSON.parse(content) as unknown;
      return Boolean(
        parsed
        && typeof parsed === 'object'
        && !Array.isArray(parsed)
        && typeof (parsed as Record<string, unknown>).error === 'string',
      );
    } catch {
      return false;
    }
  }

  steer(turn: PreparedChatTurn): Promise<boolean> {
    if (!this.loop) {
      return Promise.resolve(false);
    }
    this.loop.steer(turn.persistedContent);
    return Promise.resolve(true);
  }

  cancel(): void {
    this.cancelled = true;
    this.loop?.abort();
  }

  resetSession(): void {
    this.cancel();
    this.loop = null;
    this.prefix = null;
    this.tools = null;
    this.sessionId = null;
    this.pendingHydrationMessages = null;
    this.loopHydrated = false;
    this.sessionInvalidated = false;
    this.turnMetadata = {};
    void this.clearMcpBridge();
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  consumeSessionInvalidation(): boolean {
    const invalidated = this.sessionInvalidated;
    this.sessionInvalidated = false;
    return invalidated;
  }

  isReady(): boolean {
    return Boolean(this.getSettings().apiKey);
  }

  async getSupportedCommands(): Promise<SlashCommand[]> {
    return REASONIX_STATIC_COMMANDS;
  }

  cleanup(): void {
    this.cancel();
    this.client = null;
    this.loop = null;
    this.prefix = null;
    this.tools = null;
    this.currentSystemPrompt = '';
    this.pendingHydrationMessages = null;
    this.loopHydrated = false;
    void this.clearMcpBridge();
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
    const metadata = this.turnMetadata;
    this.turnMetadata = {};
    return metadata;
  }

  buildSessionUpdates(params: {
    conversation: Conversation | null;
    sessionInvalidated: boolean;
  }): SessionUpdateResult {
    const nextSessionId = this.sessionId ?? params.conversation?.sessionId ?? null;
    return {
      updates: {
        sessionId: params.sessionInvalidated ? null : nextSessionId,
      },
    };
  }

  resolveSessionIdForFork(
    _conversation: Conversation | null,
  ): string | null {
    return null;
  }
}
