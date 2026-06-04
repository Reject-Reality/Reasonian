import type { ProviderCommandCatalog } from '../../../core/providers/commands/ProviderCommandCatalog';
import type { ProviderCommandEntry } from '../../../core/providers/commands/ProviderCommandEntry';
import type { VaultFileAdapter } from '../../../core/storage/VaultFileAdapter';
import type { SlashCommand } from '../../../core/types';
import {
  extractString,
  parseFrontmatter,
} from '../../../utils/frontmatter';
import {
  extractFirstParagraph,
  parseSlashCommandContent,
  parsedToSlashCommand,
  serializeSlashCommandMarkdown,
} from '../../../utils/slashCommand';

const PROVIDER_ID = 'reasonix';
const COMMANDS_ROOT = '.reasonix/commands';
const SKILLS_ROOT = '.reasonix/skills';
const SKILL_FILE = 'SKILL.md';

type VaultEntryKind = 'command' | 'skill';

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
    argumentHint: '[list|show|write|forget|status]',
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

function normalizeVaultPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
}

function stripMarkdownExtension(path: string): string {
  return path.endsWith('.md') ? path.slice(0, -3) : path;
}

function commandNameFromPath(path: string): string {
  const fileName = normalizeVaultPath(path).split('/').pop() ?? path;
  return stripMarkdownExtension(fileName);
}

function skillNameFromPath(path: string): string {
  const normalized = normalizeVaultPath(path);
  if (normalized.endsWith(`/${SKILL_FILE}`)) {
    const parts = normalized.split('/');
    return parts[parts.length - 2] ?? '';
  }

  const fileName = normalized.split('/').pop() ?? normalized;
  return stripMarkdownExtension(fileName);
}

function defaultVaultPath(kind: VaultEntryKind, name: string): string {
  return kind === 'skill'
    ? `${SKILLS_ROOT}/${name}/${SKILL_FILE}`
    : `${COMMANDS_ROOT}/${name}.md`;
}

function isReasonixCommandPath(path: string): boolean {
  const normalized = normalizeVaultPath(path);
  return normalized.startsWith(`${COMMANDS_ROOT}/`) && normalized.endsWith('.md');
}

function isReasonixSkillPath(path: string): boolean {
  const normalized = normalizeVaultPath(path);
  const rootPrefix = `${SKILLS_ROOT}/`;
  if (!normalized.startsWith(rootPrefix) || !normalized.endsWith('.md')) {
    return false;
  }

  const relativePath = normalized.slice(rootPrefix.length);
  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length === 1) {
    return parts[0] !== SKILL_FILE;
  }

  return parts.length === 2 && parts[1] === SKILL_FILE;
}

export function isReasonixCommandCatalogPath(path: string): boolean {
  const normalized = normalizeVaultPath(path);
  return normalized === COMMANDS_ROOT
    || normalized.startsWith(`${COMMANDS_ROOT}/`)
    || normalized === SKILLS_ROOT
    || normalized.startsWith(`${SKILLS_ROOT}/`);
}

function slashCommandToEntry(
  command: SlashCommand,
  path: string,
  kind: VaultEntryKind,
): ProviderCommandEntry {
  return {
    id: command.id,
    providerId: PROVIDER_ID,
    kind,
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
    scope: 'vault',
    source: 'user',
    isEditable: true,
    isDeletable: true,
    displayPrefix: '/',
    insertPrefix: '/',
    persistenceKey: normalizeVaultPath(path),
  };
}

function entryToSlashCommand(entry: ProviderCommandEntry): SlashCommand {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    argumentHint: entry.argumentHint,
    allowedTools: entry.allowedTools,
    model: entry.model,
    content: entry.content,
    source: 'user',
    kind: entry.kind,
    disableModelInvocation: entry.disableModelInvocation,
    userInvocable: entry.userInvocable,
    context: entry.context,
    agent: entry.agent,
    hooks: entry.hooks,
  };
}

function entrySortKey(entry: ProviderCommandEntry): string {
  return `${entry.kind}:${entry.name.toLowerCase()}`;
}

function validateReasonixEntryName(name: string): string | null {
  if (!name) {
    return 'Command name is required';
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(name)) {
    return 'Command name must start with a letter or number and contain only letters, numbers, dots, underscores, or hyphens';
  }
  return null;
}

export class ReasonixCommandCatalog implements ProviderCommandCatalog {
  private runtimeCommands: SlashCommand[] = REASONIX_STATIC_COMMANDS;
  private vaultEntries: ProviderCommandEntry[] = [];
  private refreshInFlight: Promise<void> | null = null;
  private refreshAgain = false;

  constructor(private readonly adapter: VaultFileAdapter) {}

  async listDropdownEntries(_context?: { includeBuiltIns: boolean }): Promise<ProviderCommandEntry[]> {
    await this.refresh();
    return [
      ...this.runtimeCommands.map(commandToEntry),
      ...this.vaultEntries.filter((entry) => entry.userInvocable !== false),
    ];
  }

  async listVaultEntries(): Promise<ProviderCommandEntry[]> {
    await this.refresh();
    return [...this.vaultEntries];
  }

  async saveVaultEntry(entry: ProviderCommandEntry): Promise<void> {
    const kind: VaultEntryKind = entry.kind === 'skill' ? 'skill' : 'command';
    const name = entry.name.trim();
    const validationError = validateReasonixEntryName(name);
    if (validationError) {
      throw new Error(validationError);
    }

    const currentPath = entry.persistenceKey
      ? normalizeVaultPath(entry.persistenceKey)
      : undefined;
    const nextPath = defaultVaultPath(kind, name);
    const command = entryToSlashCommand({
      ...entry,
      name,
      kind,
      id: `reasonix:${kind}:${name}`,
    });
    const content = serializeSlashCommandMarkdown(command, entry.content);

    await this.adapter.write(nextPath, content);
    if (currentPath && currentPath !== nextPath && await this.adapter.exists(currentPath)) {
      await this.adapter.delete(currentPath);
      await this.deleteEmptySkillFolder(currentPath);
    }

    await this.refresh();
  }

  async deleteVaultEntry(entry: ProviderCommandEntry): Promise<void> {
    const path = entry.persistenceKey
      ? normalizeVaultPath(entry.persistenceKey)
      : defaultVaultPath(entry.kind === 'skill' ? 'skill' : 'command', entry.name);

    await this.adapter.delete(path);
    await this.deleteEmptySkillFolder(path);
    await this.refresh();
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

  getCommandByName(name: string): SlashCommand | null {
    const normalized = name.toLowerCase();
    const runtimeCommand = this.runtimeCommands.find(
      (entry) => entry.name.toLowerCase() === normalized,
    );
    if (runtimeCommand) {
      return runtimeCommand;
    }

    const vaultEntry = this.vaultEntries.find(
      (entry) => entry.name.toLowerCase() === normalized && entry.userInvocable !== false,
    );
    return vaultEntry ? entryToSlashCommand(vaultEntry) : null;
  }

  getCachedVaultEntries(): ProviderCommandEntry[] {
    return [...this.vaultEntries];
  }

  scheduleRefresh(): void {
    void this.refresh().catch((error) => {
      console.warn('Failed to refresh Reasonix command catalog', error);
    });
  }

  async refresh(): Promise<void> {
    if (this.refreshInFlight) {
      this.refreshAgain = true;
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.refreshUntilSettled().finally(() => {
      this.refreshInFlight = null;
    });

    return this.refreshInFlight;
  }

  private async refreshUntilSettled(): Promise<void> {
    do {
      this.refreshAgain = false;
      await this.refreshOnce();
    } while (this.refreshAgain);
  }

  private async refreshOnce(): Promise<void> {
    const entries = [
      ...await this.loadCommandEntries(),
      ...await this.loadSkillEntries(),
    ];

    const seen = new Set(this.runtimeCommands.map((command) => command.name.toLowerCase()));
    this.vaultEntries = entries
      .filter((entry) => {
        const key = entry.name.toLowerCase();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .sort((a, b) => entrySortKey(a).localeCompare(entrySortKey(b)));
  }

  private async loadCommandEntries(): Promise<ProviderCommandEntry[]> {
    const files = await this.adapter.listFilesRecursive(COMMANDS_ROOT);
    const entries: ProviderCommandEntry[] = [];

    for (const rawPath of files) {
      const path = normalizeVaultPath(rawPath);
      if (!isReasonixCommandPath(path)) {
        continue;
      }

      const entry = await this.tryReadVaultEntry(path, 'command', commandNameFromPath(path));
      if (entry) {
        entries.push(entry);
      }
    }

    return entries;
  }

  private async loadSkillEntries(): Promise<ProviderCommandEntry[]> {
    const files = await this.adapter.listFilesRecursive(SKILLS_ROOT);
    const entries: ProviderCommandEntry[] = [];

    for (const rawPath of files) {
      const path = normalizeVaultPath(rawPath);
      if (!isReasonixSkillPath(path)) {
        continue;
      }

      const entry = await this.tryReadVaultEntry(path, 'skill', skillNameFromPath(path));
      if (entry) {
        entries.push(entry);
      }
    }

    return entries;
  }

  private async tryReadVaultEntry(
    path: string,
    kind: VaultEntryKind,
    fallbackName: string,
  ): Promise<ProviderCommandEntry | null> {
    try {
      return await this.readVaultEntry(path, kind, fallbackName);
    } catch (error) {
      console.warn(`Failed to load Reasonix ${kind} from ${path}`, error);
      return null;
    }
  }

  private async readVaultEntry(
    path: string,
    kind: VaultEntryKind,
    fallbackName: string,
  ): Promise<ProviderCommandEntry | null> {
    const content = await this.adapter.read(path);
    const parsed = parseSlashCommandContent(content);
    const rawName = this.extractFrontmatterName(content) ?? fallbackName;
    const name = rawName.trim();
    const validationError = validateReasonixEntryName(name);
    if (validationError) {
      console.warn(`Skipping Reasonix ${kind} at ${path}: ${validationError}`);
      return null;
    }
    const command = parsedToSlashCommand(parsed, {
      id: `reasonix:${kind}:${name}`,
      name,
      source: 'user',
    });

    if (!command.description) {
      command.description = extractFirstParagraph(command.content);
    }
    command.kind = kind;
    command.source = 'user';

    return slashCommandToEntry(command, path, kind);
  }

  private extractFrontmatterName(content: string): string | undefined {
    const parsed = parseFrontmatter(content);
    return parsed ? extractString(parsed.frontmatter, 'name') : undefined;
  }

  private async deleteEmptySkillFolder(path: string): Promise<void> {
    const normalized = normalizeVaultPath(path);
    if (!normalized.startsWith(`${SKILLS_ROOT}/`) || !normalized.endsWith(`/${SKILL_FILE}`)) {
      return;
    }

    const folder = normalized.slice(0, -(`/${SKILL_FILE}`).length);
    await this.adapter.deleteFolder(folder);
  }
}
