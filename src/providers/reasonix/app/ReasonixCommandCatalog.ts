import type { ProviderCommandCatalog } from '../../../core/providers/commands/ProviderCommandCatalog';
import type { ProviderCommandEntry } from '../../../core/providers/commands/ProviderCommandEntry';
import type { SlashCommand } from '../../../core/types';

const PROVIDER_ID = 'reasonix';

export const REASONIX_STATIC_COMMANDS: SlashCommand[] = [
  {
    id: 'reasonix:compact',
    name: 'compact',
    description: 'Compact older conversation turns into a summary',
    content: '',
    source: 'sdk',
    kind: 'command',
    disableModelInvocation: true,
  },
  {
    id: 'reasonix:status',
    name: 'status',
    description: 'Show Reasonix runtime status',
    content: '',
    source: 'sdk',
    kind: 'command',
    disableModelInvocation: true,
  },
  {
    id: 'reasonix:context',
    name: 'context',
    description: 'Show current Reasonix context usage',
    content: '',
    source: 'sdk',
    kind: 'command',
    disableModelInvocation: true,
  },
  {
    id: 'reasonix:mcp',
    name: 'mcp',
    description: 'Show configured MCP servers',
    content: '',
    source: 'sdk',
    kind: 'command',
    disableModelInvocation: true,
  },
  {
    id: 'reasonix:memory',
    name: 'memory',
    description: 'Show Reasonix memory status',
    content: '',
    source: 'sdk',
    kind: 'command',
    disableModelInvocation: true,
  },
  {
    id: 'reasonix:help',
    name: 'help',
    description: 'Show supported Reasonix commands in Obsidian',
    content: '',
    source: 'sdk',
    kind: 'command',
    disableModelInvocation: true,
  },
  {
    id: 'reasonix:model',
    name: 'model',
    description: 'Show or switch the Reasonix model',
    argumentHint: '[flash|pro|model-id]',
    content: '',
    source: 'sdk',
    kind: 'command',
    disableModelInvocation: true,
  },
  {
    id: 'reasonix:effort',
    name: 'effort',
    description: 'Show or switch reasoning effort',
    argumentHint: '[low|medium|high|max]',
    content: '',
    source: 'sdk',
    kind: 'command',
    disableModelInvocation: true,
  },
  {
    id: 'reasonix:max-tokens',
    name: 'max-tokens',
    description: 'Show or set the per-turn output token cap',
    argumentHint: '[N|off]',
    content: '',
    source: 'sdk',
    kind: 'command',
    disableModelInvocation: true,
  },
  {
    id: 'reasonix:budget',
    name: 'budget',
    description: 'Show or set the session budget cap in USD',
    argumentHint: '[usd|off]',
    content: '',
    source: 'sdk',
    kind: 'command',
    disableModelInvocation: true,
  },
  {
    id: 'reasonix:plan',
    name: 'plan',
    description: 'Ask Reasonix to create an implementation plan',
    argumentHint: '[goal]',
    content: 'Create a concise implementation plan for this goal. Do not start implementation until the plan is clear.\n\nGoal:\n$ARGUMENTS',
    source: 'sdk',
    kind: 'command',
  },
  {
    id: 'reasonix:review',
    name: 'review',
    description: 'Review code, notes, or a proposed change',
    argumentHint: '[focus]',
    content: 'Review the following with a bug-risk-first lens. Call out concrete issues, missing checks, and suggested fixes.\n\nFocus:\n$ARGUMENTS',
    source: 'sdk',
    kind: 'command',
  },
  {
    id: 'reasonix:summarize',
    name: 'summarize',
    description: 'Summarize the current material',
    argumentHint: '[focus]',
    content: 'Summarize the current material clearly. Preserve important decisions, open questions, and next actions.\n\nFocus:\n$ARGUMENTS',
    source: 'sdk',
    kind: 'command',
  },
  {
    id: 'reasonix:explain',
    name: 'explain',
    description: 'Explain a topic or selected context',
    argumentHint: '[topic]',
    content: 'Explain this in a practical way, with the assumptions and tradeoffs made explicit.\n\nTopic:\n$ARGUMENTS',
    source: 'sdk',
    kind: 'command',
  },
];

function commandToEntry(command: SlashCommand): ProviderCommandEntry {
  return {
    id: command.id,
    providerId: PROVIDER_ID,
    kind: command.kind ?? 'command',
    name: command.name,
    description: command.description,
    content: command.content,
    argumentHint: command.argumentHint,
    allowedTools: command.allowedTools,
    model: command.model,
    disableModelInvocation: command.disableModelInvocation,
    userInvocable: command.userInvocable,
    context: command.context,
    agent: command.agent,
    hooks: command.hooks,
    scope: 'runtime',
    source: command.source ?? 'sdk',
    isEditable: false,
    isDeletable: false,
    displayPrefix: '/',
    insertPrefix: '/',
  };
}

export class ReasonixCommandCatalog implements ProviderCommandCatalog {
  private runtimeCommands: SlashCommand[] = REASONIX_STATIC_COMMANDS;

  async listDropdownEntries(): Promise<ProviderCommandEntry[]> {
    return this.runtimeCommands.map(commandToEntry);
  }

  async listVaultEntries(): Promise<ProviderCommandEntry[]> {
    return [];
  }

  async saveVaultEntry(_entry: ProviderCommandEntry): Promise<void> {
    throw new Error('Reasonix vault commands are not supported yet.');
  }

  async deleteVaultEntry(_entry: ProviderCommandEntry): Promise<void> {
    throw new Error('Reasonix vault commands are not supported yet.');
  }

  setRuntimeCommands(commands: SlashCommand[]): void {
    this.runtimeCommands = commands.length > 0 ? commands : REASONIX_STATIC_COMMANDS;
  }

  getDropdownConfig() {
    return {
      providerId: PROVIDER_ID,
      triggerChars: ['/'],
      builtInPrefix: '/',
      skillPrefix: '/',
      commandPrefix: '/',
    };
  }

  async refresh(): Promise<void> {}
}
