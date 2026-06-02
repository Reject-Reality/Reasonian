import { McpServerManager } from '../../../core/mcp/McpServerManager';
import type {
  ProviderWorkspaceInitContext,
  ProviderWorkspaceRegistration,
  ProviderWorkspaceServices,
} from '../../../core/providers/types';
import { ReasonixCommandCatalog } from './ReasonixCommandCatalog';
import { ReasonixMcpStorage } from './ReasonixMcpStorage';
import { ReasonixSettingsTabRenderer } from '../ui/ReasonixSettingsTabRenderer';

class ReasonixWorkspaceServices implements ProviderWorkspaceServices {
  agentMentionProvider = null;
  cliResolver = null;

  constructor(
    readonly commandCatalog: ReasonixCommandCatalog,
    readonly mcpServerManager: McpServerManager,
    readonly settingsTabRenderer: ReasonixSettingsTabRenderer,
  ) {}
}

export const reasonixWorkspaceRegistration: ProviderWorkspaceRegistration = {
  async initialize(context: ProviderWorkspaceInitContext): Promise<ProviderWorkspaceServices> {
    const mcpStorage = new ReasonixMcpStorage(context.vaultAdapter);
    const mcpServerManager = new McpServerManager(mcpStorage);
    await mcpServerManager.loadServers();

    return new ReasonixWorkspaceServices(
      new ReasonixCommandCatalog(),
      mcpServerManager,
      new ReasonixSettingsTabRenderer(mcpStorage, mcpServerManager),
    );
  },
};
