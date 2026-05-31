import { ProviderRegistry } from '../core/providers/ProviderRegistry';
import { reasonixProviderRegistration } from './reasonix/registration';

let builtInProvidersRegistered = false;

export function registerBuiltInProviders(): void {
  if (builtInProvidersRegistered) {
    return;
  }

  ProviderRegistry.register('reasonix', reasonixProviderRegistration);
  builtInProvidersRegistered = true;
}

registerBuiltInProviders();
