import { McpServerManager } from '../../../core/mcp/McpServerManager';
import type {
  ProviderWorkspaceInitContext,
  ProviderWorkspaceRegistration,
  ProviderWorkspaceServices,
} from '../../../core/providers/types';
import {
  isReasonixCommandCatalogPath,
  ReasonixCommandCatalog,
} from './ReasonixCommandCatalog';
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

function registerCommandCatalogVaultListeners(
  context: ProviderWorkspaceInitContext,
  commandCatalog: ReasonixCommandCatalog,
): void {
  const refreshIfRelevant = (...paths: Array<string | undefined | null>) => {
    if (paths.some((path) => path && isReasonixCommandCatalogPath(path))) {
      commandCatalog.scheduleRefresh();
    }
  };

  context.plugin.registerEvent(
    context.plugin.app.vault.on('create', (file) => refreshIfRelevant(file.path)),
  );
  context.plugin.registerEvent(
    context.plugin.app.vault.on('modify', (file) => refreshIfRelevant(file.path)),
  );
  context.plugin.registerEvent(
    context.plugin.app.vault.on('delete', (file) => refreshIfRelevant(file.path)),
  );
  context.plugin.registerEvent(
    context.plugin.app.vault.on('rename', (file, oldPath) => refreshIfRelevant(file.path, oldPath)),
  );
}

export const reasonixWorkspaceRegistration: ProviderWorkspaceRegistration = {
  async initialize(context: ProviderWorkspaceInitContext): Promise<ProviderWorkspaceServices> {
    const mcpStorage = new ReasonixMcpStorage(context.vaultAdapter);
    const mcpServerManager = new McpServerManager(mcpStorage);
    await mcpServerManager.loadServers();
    const commandCatalog = new ReasonixCommandCatalog(context.vaultAdapter);
    await commandCatalog.refresh();
    registerCommandCatalogVaultListeners(context, commandCatalog);

    return new ReasonixWorkspaceServices(
      commandCatalog,
      mcpServerManager,
      new ReasonixSettingsTabRenderer(mcpStorage, mcpServerManager, commandCatalog),
    );
  },
};
