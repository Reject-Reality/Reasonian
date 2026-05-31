import type { ProviderCommandCatalog } from './commands/ProviderCommandCatalog';
import type {
  AgentMentionProvider,
  ProviderCliResolver,
  ProviderId,
  ProviderSettingsTabRenderer,
} from './types';

/**
 * Simplified workspace registry for single-provider (Reasonix).
 * All methods return null — no CLI, no runtime command catalogs, no agent mentions.
 * Kept as a stub so existing feature code doesn't break.
 */
export class ProviderWorkspaceRegistry {
  private static services: Partial<Record<ProviderId, any>> = {};

  static async initializeAll(): Promise<void> {}

  static setServices(providerId: ProviderId, services: any | undefined): void {
    if (services) {
      this.services[providerId] = services;
    } else {
      delete this.services[providerId];
    }
  }

  static clear(): void {
    this.services = {};
  }

  static getCommandCatalog(_providerId: ProviderId): ProviderCommandCatalog | null {
    return null;
  }

  static getAgentMentionProvider(_providerId: ProviderId): AgentMentionProvider | null {
    return null;
  }

  static async refreshAgentMentions(_providerId: ProviderId): Promise<void> {}

  static getCliResolver(_providerId: ProviderId): ProviderCliResolver | null {
    return null;
  }

  static getMcpServerManager(_providerId: ProviderId) {
    return null;
  }

  static getSettingsTabRenderer(_providerId: ProviderId): ProviderSettingsTabRenderer | null {
    return null;
  }
}
