import { tryParseClipboardConfig } from '../../../core/mcp/McpConfigParser';
import type { AppMcpStorage } from '../../../core/providers/types';
import type {
  ManagedMcpConfigFile,
  ManagedMcpServer,
  McpServerConfig,
} from '../../../core/types';
import { DEFAULT_MCP_SERVER, isValidMcpServerConfig } from '../../../core/types';
import type { VaultFileAdapter } from '../../../core/storage/VaultFileAdapter';

const MCP_CONFIG_PATH = '.reasonix/mcp.json';
const LEGACY_MCP_CONFIG_PATH = '.claude/mcp.json';

export class ReasonixMcpStorage implements AppMcpStorage {
  constructor(private readonly adapter: VaultFileAdapter) {}

  async load(): Promise<ManagedMcpServer[]> {
    const loadPath = await this.resolveLoadPath();
    if (!loadPath) {
      return [];
    }

    try {
      const raw = await this.adapter.read(loadPath);
      const parsed = JSON.parse(raw) as ManagedMcpConfigFile;
      return this.decodeManagedServers(parsed);
    } catch {
      return [];
    }
  }

  async save(servers: ManagedMcpServer[]): Promise<void> {
    const payload = this.encodeManagedConfig(servers);
    await this.adapter.write(MCP_CONFIG_PATH, JSON.stringify(payload, null, 2));
  }

  tryParseClipboardConfig(text: string): unknown | null {
    return tryParseClipboardConfig(text);
  }

  private async resolveLoadPath(): Promise<string | null> {
    if (await this.adapter.exists(MCP_CONFIG_PATH)) {
      return MCP_CONFIG_PATH;
    }
    if (await this.adapter.exists(LEGACY_MCP_CONFIG_PATH)) {
      return LEGACY_MCP_CONFIG_PATH;
    }
    return null;
  }

  private decodeManagedServers(config: ManagedMcpConfigFile): ManagedMcpServer[] {
    const servers = config?.mcpServers;
    if (!servers || typeof servers !== 'object') {
      return [];
    }

    const meta = config._claudian?.servers ?? {};
    const managed: ManagedMcpServer[] = [];

    for (const [name, serverConfig] of Object.entries(servers)) {
      if (!isValidMcpServerConfig(serverConfig)) {
        continue;
      }

      const serverMeta = meta[name] ?? {};
      managed.push({
        name,
        config: serverConfig as McpServerConfig,
        enabled: serverMeta.enabled ?? DEFAULT_MCP_SERVER.enabled,
        contextSaving: serverMeta.contextSaving ?? DEFAULT_MCP_SERVER.contextSaving,
        disabledTools: Array.isArray(serverMeta.disabledTools)
          ? serverMeta.disabledTools.filter((tool): tool is string => typeof tool === 'string' && tool.length > 0)
          : undefined,
        description: typeof serverMeta.description === 'string' ? serverMeta.description : undefined,
      });
    }

    return managed;
  }

  private encodeManagedConfig(servers: ManagedMcpServer[]): ManagedMcpConfigFile {
    const payload: ManagedMcpConfigFile = {
      mcpServers: {},
      _claudian: {
        servers: {},
      },
    };

    for (const server of servers) {
      payload.mcpServers[server.name] = server.config;
      payload._claudian!.servers[server.name] = {
        enabled: server.enabled,
        contextSaving: server.contextSaving,
        disabledTools: server.disabledTools,
        description: server.description,
      };
    }

    return payload;
  }
}
