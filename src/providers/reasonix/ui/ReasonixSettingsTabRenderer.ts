import { Setting } from 'obsidian';

import type { McpServerManager } from '../../../core/mcp/McpServerManager';
import type {
  AppMcpStorage,
  ProviderSettingsTabRenderer,
  ProviderSettingsTabRendererContext,
} from '../../../core/providers/types';
import { renderEnvironmentSettingsSection } from '../../../features/settings/ui/EnvironmentSettingsSection';
import { McpSettingsManager } from '../../../features/settings/ui/McpSettingsManager';
import {
  getReasonixProviderSettings,
  updateReasonixProviderSettings,
} from '../settings';

export class ReasonixSettingsTabRenderer implements ProviderSettingsTabRenderer {
  constructor(
    private readonly mcpStorage: AppMcpStorage,
    private readonly mcpServerManager: McpServerManager,
  ) {}

  render(container: HTMLElement, context: ProviderSettingsTabRendererContext): void {
    container.empty();

    new Setting(container).setName('Reasonix Workspace').setHeading();
    const settings = getReasonixProviderSettings(
      context.plugin.settings as unknown as Record<string, unknown>,
    );
    const reloadReasonixSettings = async (): Promise<void> => {
      for (const view of context.plugin.getAllViews()) {
        const tabManager = view.getTabManager();
        if (!tabManager) {
          continue;
        }

        await tabManager.broadcastToAllTabs(async (service) => {
          if (service.providerId !== 'reasonix') {
            return;
          }

          const reload = (service as { reloadProviderSettings?: () => Promise<void> })
            .reloadProviderSettings;
          if (reload) {
            await reload.call(service);
          }
        });
      }
    };

    const memorySection = container.createDiv({ cls: 'claudian-provider-settings-section' });
    new Setting(memorySection)
      .setName('Reasonix Memory')
      .setDesc('Load Reasonix project memory and user memory into the system prompt.');

    new Setting(memorySection)
      .setName('Enable memory')
      .setDesc('Includes project memory plus global and project-scoped Reasonix user memory.')
      .addToggle((toggle) => toggle
        .setValue(settings.memoryEnabled)
        .onChange(async (value) => {
          updateReasonixProviderSettings(
            context.plugin.settings as unknown as Record<string, unknown>,
            { memoryEnabled: value },
          );
          await context.plugin.saveSettings();
          await reloadReasonixSettings();
        }));

    new Setting(memorySection)
      .setName('Project memory root')
      .setDesc('Folder used for REASONIX.md and project-scoped memory. Empty uses the current vault root.')
      .addText((text) => text
        .setPlaceholder('Empty = vault root')
        .setValue(settings.projectMemoryRoot)
        .onChange(async (value) => {
          updateReasonixProviderSettings(
            context.plugin.settings as unknown as Record<string, unknown>,
            { projectMemoryRoot: value.trim() },
          );
          await context.plugin.saveSettings();
          await reloadReasonixSettings();
        }));

    new Setting(memorySection)
      .setName('Reasonix home')
      .setDesc('Folder used for global Reasonix memory. Empty uses ~/.reasonix.')
      .addText((text) => text
        .setPlaceholder('Empty = ~/.reasonix')
        .setValue(settings.memoryHomeDir)
        .onChange(async (value) => {
          updateReasonixProviderSettings(
            context.plugin.settings as unknown as Record<string, unknown>,
            { memoryHomeDir: value.trim() },
          );
          await context.plugin.saveSettings();
          await reloadReasonixSettings();
        }));

    const webSection = container.createDiv({ cls: 'claudian-provider-settings-section' });
    new Setting(webSection)
      .setName('Reasonix Web')
      .setDesc('Allow Reasonix to use web_search and web_fetch tools. Queries and fetched URLs may be sent to external services.');

    new Setting(webSection)
      .setName('Enable web tools')
      .setDesc('Registers read-only web_search and web_fetch tools for Reasonix sessions.')
      .addToggle((toggle) => toggle
        .setValue(settings.webToolsEnabled)
        .onChange(async (value) => {
          updateReasonixProviderSettings(
            context.plugin.settings as unknown as Record<string, unknown>,
            { webToolsEnabled: value },
          );
          await context.plugin.saveSettings();
          await reloadReasonixSettings();
        }));

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
