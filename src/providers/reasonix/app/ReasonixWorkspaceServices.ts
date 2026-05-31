import type ClaudianPlugin from '../../../main';
import type { ProviderWorkspaceInitContext, ProviderWorkspaceRegistration, ProviderWorkspaceServices } from '../../../core/providers/types';

/** Single-provider workspace — no external CLI or complex workspace services needed. */
class ReasonixWorkspaceServices implements ProviderWorkspaceServices {
  commandCatalog = null;
  agentMentionProvider = null;
  cliResolver = null;
  mcpServerManager = null;
  settingsTabRenderer = null;
}

export const reasonixWorkspaceRegistration: ProviderWorkspaceRegistration = {
  async initialize(_context: ProviderWorkspaceInitContext): Promise<ProviderWorkspaceServices> {
    return new ReasonixWorkspaceServices();
  },
};
