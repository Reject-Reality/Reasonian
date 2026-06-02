import { Setting } from 'obsidian';

import type { McpServerManager } from '../../../core/mcp/McpServerManager';
import type {
  AppMcpStorage,
  ProviderSettingsTabRenderer,
  ProviderSettingsTabRendererContext,
} from '../../../core/providers/types';
import { renderEnvironmentSettingsSection } from '../../../features/settings/ui/EnvironmentSettingsSection';
import { McpSettingsManager } from '../../../features/settings/ui/McpSettingsManager';

export class ReasonixSettingsTabRenderer implements ProviderSettingsTabRenderer {
  constructor(
    private readonly mcpStorage: AppMcpStorage,
    private readonly mcpServerManager: McpServerManager,
  ) {}

  render(container: HTMLElement, context: ProviderSettingsTabRendererContext): void {
    container.empty();

    new Setting(container).setName('Reasonix Workspace').setHeading();

    const mcpSection = container.createDiv({ cls: 'claudian-provider-settings-section' });
    new Setting(mcpSection)
      .setName('MCP Servers')
      .setDesc('Manage vault-level MCP server settings stored in .reasonix/mcp.json.');

    const mcpManagerContainer = mcpSection.createDiv({ cls: 'claudian-provider-mcp-settings' });
    new McpSettingsManager(mcpManagerContainer, {
      app: context.plugin.app,
      mcpStorage: this.mcpStorage,
      broadcastMcpReload: async () => {
        await this.mcpServerManager.loadServers();

        for (const view of context.plugin.getAllViews()) {
          const tabManager = view.getTabManager();
          if (!tabManager) {
            continue;
          }

          await tabManager.broadcastToAllTabs((service) => service.reloadMcpServers());

          for (const tab of tabManager.getAllTabs()) {
            tab.ui.mcpServerSelector?.setMcpManager(this.mcpServerManager);
            tab.ui.fileContextManager?.setMcpManager(this.mcpServerManager);
          }
        }
      },
    });

    renderEnvironmentSettingsSection({
      container,
      plugin: context.plugin,
      scope: 'provider:reasonix',
      heading: 'Provider Environment',
      name: 'Reasonix environment',
      desc: 'Variables loaded only for the Reasonix provider runtime.',
      placeholder: 'DEEPSEEK_API_KEY=sk-...\nHTTPS_PROXY=http://proxy.example.com:8080',
      renderCustomContextLimits: (target) => context.renderCustomContextLimits(target, 'reasonix'),
    });
  }
}
