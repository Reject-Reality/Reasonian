import type { McpServerManager } from '../mcp/McpServerManager';
import type { ProviderCommandCatalog } from './commands/ProviderCommandCatalog';
import type {
  AgentMentionProvider,
  ProviderCliResolver,
  ProviderId,
  ProviderSettingsTabRenderer,
  ProviderWorkspaceInitContext,
  ProviderWorkspaceRegistration,
  ProviderWorkspaceServices,
} from './types';
import { reasonixWorkspaceRegistration } from '../../providers/reasonix/app/ReasonixWorkspaceServices';

const WORKSPACE_REGISTRATIONS: Partial<Record<ProviderId, ProviderWorkspaceRegistration>> = {
  reasonix: reasonixWorkspaceRegistration,
};

export class ProviderWorkspaceRegistry {
  private static services: Partial<Record<ProviderId, ProviderWorkspaceServices>> = {};

  static async initializeAll(context: ProviderWorkspaceInitContext): Promise<void> {
    this.clear();

    for (const [providerId, registration] of Object.entries(WORKSPACE_REGISTRATIONS)) {
      if (!registration) {
        continue;
      }

      try {
        const services = await registration.initialize(context);
        this.setServices(providerId as ProviderId, services);
      } catch (error) {
        console.error(`Failed to initialize workspace services for provider "${providerId}"`, error);
      }
    }
  }

  static setServices(
    providerId: ProviderId,
    services: ProviderWorkspaceServices | undefined,
  ): void {
    if (services) {
      this.services[providerId] = services;
    } else {
      delete this.services[providerId];
    }
  }

  static clear(): void {
    this.services = {};
  }

  static getCommandCatalog(providerId: ProviderId): ProviderCommandCatalog | null {
    return this.services[providerId]?.commandCatalog ?? null;
  }

  static getAgentMentionProvider(providerId: ProviderId): AgentMentionProvider | null {
    return this.services[providerId]?.agentMentionProvider ?? null;
  }

  static async refreshAgentMentions(providerId: ProviderId): Promise<void> {
    await this.services[providerId]?.refreshAgentMentions?.();
  }

  static getCliResolver(providerId: ProviderId): ProviderCliResolver | null {
    return this.services[providerId]?.cliResolver ?? null;
  }

  static getMcpServerManager(providerId: ProviderId): McpServerManager | null {
    return this.services[providerId]?.mcpServerManager ?? null;
  }

  static getSettingsTabRenderer(providerId: ProviderId): ProviderSettingsTabRenderer | null {
    return this.services[providerId]?.settingsTabRenderer ?? null;
  }
}
