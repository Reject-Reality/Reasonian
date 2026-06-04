import * as path from 'path';
import { Notice, Setting } from 'obsidian';

import type { McpServerManager } from '../../../core/mcp/McpServerManager';
import type {
  AppMcpStorage,
  ProviderSettingsTabRenderer,
  ProviderSettingsTabRendererContext,
} from '../../../core/providers/types';
import { renderEnvironmentSettingsSection } from '../../../features/settings/ui/EnvironmentSettingsSection';
import { McpSettingsManager } from '../../../features/settings/ui/McpSettingsManager';
import { getVaultPath } from '../../../utils/path';
import { ReasonixCommandCatalog } from '../app/ReasonixCommandCatalog';
import { runReasonixAuxiliaryChat } from '../auxiliary/ReasonixAuxiliaryClient';
import { ReasonixCommandSettingsManager } from './ReasonixCommandSettingsManager';
import { reasonixChatUIConfig } from './ReasonixChatUIConfig';
import { trReasonix } from './reasonixI18n';
import {
  getReasonixProviderSettings,
  updateReasonixProviderSettings,
} from '../settings';

export class ReasonixSettingsTabRenderer implements ProviderSettingsTabRenderer {
  constructor(
    private readonly mcpStorage: AppMcpStorage,
    private readonly mcpServerManager: McpServerManager,
    private readonly commandCatalog: ReasonixCommandCatalog,
  ) {}

  render(container: HTMLElement, context: ProviderSettingsTabRendererContext): void {
    container.empty();

    new Setting(container).setName(trReasonix('workspaceHeading')).setHeading();
    const settings = getReasonixProviderSettings(
      context.plugin.settings as unknown as Record<string, unknown>,
    );
    const vaultPath = getVaultPath(context.plugin.app) ?? '';
    const pluginDirName = context.plugin.manifest.dir || context.plugin.manifest.id || 'reasonian';
    const mcpConfigPath = vaultPath
      ? path.join(vaultPath, '.reasonix', 'mcp.json')
      : '.reasonix/mcp.json';
    const grammarPath = vaultPath
      ? path.join(vaultPath, '.obsidian', 'plugins', pluginDirName, 'grammars')
      : '.obsidian/plugins/<plugin>/grammars';
    const projectMemoryRoot = settings.projectMemoryRoot.trim() || vaultPath || '(vault root)';
    const reasonixHome = settings.memoryHomeDir.trim() || '~/.reasonix';
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
    const saveSettings = async (updates: Partial<typeof settings>): Promise<void> => {
      updateReasonixProviderSettings(
        context.plugin.settings as unknown as Record<string, unknown>,
        updates,
      );
      await context.plugin.saveSettings();
    };

    const runtimeSection = container.createDiv({ cls: 'claudian-provider-settings-section' });
    new Setting(runtimeSection)
      .setName('Reasonix Runtime')
      .setDesc(
        settings.apiKey
          ? `Ready to start sessions. Default model: ${settings.model}.`
          : 'Setup required. Add a DeepSeek API key to enable Reasonix chat.',
      );

    new Setting(runtimeSection)
      .setName('API Key')
      .setDesc('DeepSeek API key used by Reasonix chat and auxiliary services.')
      .addText((text) => {
        text
          .setPlaceholder('sk-...')
          .setValue(settings.apiKey)
          .onChange(async (value) => {
            await saveSettings({ apiKey: value.trim() });
            await reloadReasonixSettings();
          });
        text.inputEl.type = 'password';
      });

    new Setting(runtimeSection)
      .setName('Base URL')
      .setDesc('Custom DeepSeek-compatible API endpoint. Leave empty to use the default DeepSeek API.')
      .addText((text) => text
        .setPlaceholder('https://api.deepseek.com')
        .setValue(settings.baseUrl)
        .onChange(async (value) => {
          await saveSettings({ baseUrl: value.trim() });
          await reloadReasonixSettings();
        }));

    new Setting(runtimeSection)
      .setName('Model')
      .setDesc('Default model used for new Reasonix turns.')
      .addDropdown((dropdown) => {
        for (const option of reasonixChatUIConfig.getModelOptions({})) {
          dropdown.addOption(option.value, option.label);
        }
        dropdown
          .setValue(settings.model)
          .onChange(async (value) => {
            await saveSettings({ model: value, lastModel: value });
            context.refreshModelSelectors();
            await reloadReasonixSettings();
          });
      });

    new Setting(runtimeSection)
      .setName('Reasoning Effort')
      .setDesc('Controls how much deliberate reasoning Reasonix uses per turn.')
      .addDropdown((dropdown) => {
        for (const option of reasonixChatUIConfig.getReasoningOptions(settings.model)) {
          dropdown.addOption(option.value, option.label);
        }
        dropdown
          .setValue(settings.reasoningEffort)
          .onChange(async (value) => {
            await saveSettings({
              reasoningEffort: value as typeof settings.reasoningEffort,
            });
            context.refreshModelSelectors();
            await reloadReasonixSettings();
          });
      });

    new Setting(runtimeSection)
      .setName('Max Output Tokens')
      .setDesc('0 means auto. Caps the maximum output tokens for each Reasonix turn.')
      .addText((text) => text
        .setPlaceholder('0')
        .setValue(settings.maxOutputTokens > 0 ? String(settings.maxOutputTokens) : '')
        .onChange(async (value) => {
          const trimmed = value.trim();
          const parsed = trimmed ? Number.parseInt(trimmed, 10) : 0;
          if (!trimmed || (Number.isFinite(parsed) && parsed >= 0)) {
            await saveSettings({ maxOutputTokens: !trimmed ? 0 : parsed });
            await reloadReasonixSettings();
          }
        }));

    new Setting(runtimeSection)
      .setName('Budget Cap (USD)')
      .setDesc('Optional soft budget cap. Leave empty to disable.')
      .addText((text) => text
        .setPlaceholder('off')
        .setValue(settings.budgetUsd && settings.budgetUsd > 0 ? String(settings.budgetUsd) : '')
        .onChange(async (value) => {
          const trimmed = value.trim();
          const parsed = trimmed ? Number(trimmed) : NaN;
          if (!trimmed) {
            await saveSettings({ budgetUsd: null });
            await reloadReasonixSettings();
            return;
          }
          if (Number.isFinite(parsed) && parsed > 0) {
            await saveSettings({ budgetUsd: parsed });
            await reloadReasonixSettings();
          }
        }));

    new Setting(runtimeSection)
      .setName('Max Iterations Per Turn')
      .setDesc('Upper bound for tool-use iterations inside one Reasonix turn.')
      .addText((text) => text
        .setPlaceholder('50')
        .setValue(String(settings.maxIterPerTurn))
        .onChange(async (value) => {
          const parsed = Number.parseInt(value.trim(), 10);
          if (Number.isFinite(parsed) && parsed > 0) {
            await saveSettings({ maxIterPerTurn: parsed });
            await reloadReasonixSettings();
          }
        }));

    new Setting(runtimeSection)
      .setName('Runtime Paths')
      .setDesc([
        `Project memory root: ${projectMemoryRoot}`,
        `Reasonix home: ${reasonixHome}`,
        `MCP config: ${mcpConfigPath}`,
        `Grammar assets: ${grammarPath}`,
      ].join('\n'));

    const runConnectivityCheck = async (
      mode: 'api' | 'model',
      triggerEl: HTMLButtonElement,
    ): Promise<void> => {
      const latestSettings = getReasonixProviderSettings(
        context.plugin.settings as unknown as Record<string, unknown>,
      );
      if (!latestSettings.apiKey.trim()) {
        new Notice('Add an API key before running the Reasonix connectivity check.');
        return;
      }

      const idleLabel = mode === 'api' ? 'Test API Key' : 'Test Model';
      const runningLabel = mode === 'api' ? 'Testing API Key...' : 'Testing Model...';
      triggerEl.disabled = true;
      triggerEl.setText(runningLabel);

      try {
        const reply = await runReasonixAuxiliaryChat(context.plugin, {
          system: mode === 'api'
            ? 'Return exactly: API connection OK'
            : 'Return exactly: MODEL connection OK',
          messages: [
            {
              role: 'user',
              content: mode === 'api'
                ? 'Verify the configured DeepSeek API credentials and respond with the exact success string.'
                : `Verify that the configured model "${latestSettings.model}" is callable and respond with the exact success string.`,
            },
          ],
          maxTokens: 24,
          temperature: 0,
          model: mode === 'api' ? undefined : latestSettings.model,
        });

        const summary = reply.replace(/\s+/g, ' ').trim();
        const successMessage = mode === 'api'
          ? `Reasonix API check passed. ${summary}`
          : `Reasonix model check passed for ${latestSettings.model}. ${summary}`;
        new Notice(successMessage, 6000);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failureMessage = mode === 'api'
          ? `Reasonix API check failed: ${message}`
          : `Reasonix model check failed: ${message}`;
        new Notice(failureMessage, 8000);
      } finally {
        triggerEl.disabled = false;
        triggerEl.setText(idleLabel);
      }
    };

    new Setting(runtimeSection)
      .setName('Connectivity Checks')
      .setDesc('Validate the current API key, base URL, and selected model without opening a chat tab.')
      .addButton((button) => {
        button
          .setButtonText('Test API Key')
          .onClick(async () => {
            await runConnectivityCheck('api', button.buttonEl);
          });
      })
      .addButton((button) => {
        button
          .setButtonText('Test Model')
          .setCta()
          .onClick(async () => {
            await runConnectivityCheck('model', button.buttonEl);
          });
      });

    const memorySection = container.createDiv({ cls: 'claudian-provider-settings-section' });
    new Setting(memorySection)
      .setName(trReasonix('memorySectionName'))
      .setDesc(trReasonix('memorySectionDesc'));

    new Setting(memorySection)
      .setName(trReasonix('enableMemoryName'))
      .setDesc(trReasonix('enableMemoryDesc'))
      .addToggle((toggle) => toggle
        .setValue(settings.memoryEnabled)
        .onChange(async (value) => {
          await saveSettings({ memoryEnabled: value });
          await reloadReasonixSettings();
        }));

    new Setting(memorySection)
      .setName(trReasonix('projectMemoryRootName'))
      .setDesc(trReasonix('projectMemoryRootDesc'))
      .addText((text) => text
        .setPlaceholder(trReasonix('projectMemoryRootPlaceholder'))
        .setValue(settings.projectMemoryRoot)
        .onChange(async (value) => {
          await saveSettings({ projectMemoryRoot: value.trim() });
          await reloadReasonixSettings();
        }));

    new Setting(memorySection)
      .setName(trReasonix('reasonixHomeName'))
      .setDesc(trReasonix('reasonixHomeDesc'))
      .addText((text) => text
        .setPlaceholder(trReasonix('reasonixHomePlaceholder'))
        .setValue(settings.memoryHomeDir)
        .onChange(async (value) => {
          await saveSettings({ memoryHomeDir: value.trim() });
          await reloadReasonixSettings();
        }));

    const webSection = container.createDiv({ cls: 'claudian-provider-settings-section' });
    new Setting(webSection)
      .setName(trReasonix('webSectionName'))
      .setDesc(trReasonix('webSectionDesc'));

    new Setting(webSection)
      .setName(trReasonix('enableWebToolsName'))
      .setDesc(trReasonix('enableWebToolsDesc'))
      .addToggle((toggle) => toggle
        .setValue(settings.webToolsEnabled)
        .onChange(async (value) => {
          await saveSettings({ webToolsEnabled: value });
          await reloadReasonixSettings();
        }));

    const commandSection = container.createDiv({ cls: 'claudian-provider-settings-section' });
    new Setting(commandSection)
      .setName(trReasonix('commandsSectionName'))
      .setDesc(trReasonix('commandsSectionDesc'));

    const commandManagerContainer = commandSection.createDiv({ cls: 'claudian-mcp-container' });
    new ReasonixCommandSettingsManager(
      commandManagerContainer,
      context.plugin.app,
      this.commandCatalog,
    );

    const mcpSection = container.createDiv({ cls: 'claudian-provider-settings-section' });
    new Setting(mcpSection)
      .setName(trReasonix('mcpSectionName'))
      .setDesc(trReasonix('mcpSectionDesc'));

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
      heading: trReasonix('environmentHeading'),
      name: trReasonix('environmentName'),
      desc: trReasonix('environmentDesc'),
      placeholder: trReasonix('environmentPlaceholder'),
      renderCustomContextLimits: (target) => context.renderCustomContextLimits(target, 'reasonix'),
    });
  }
}
