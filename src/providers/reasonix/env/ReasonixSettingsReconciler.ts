import type { ProviderSettingsReconciler } from '../../../core/providers/types';

/** Single-provider — reconciliation is a no-op. */
export const reasonixSettingsReconciler: ProviderSettingsReconciler = {
  reconcileModelWithEnvironment() {
    return { changed: false, invalidatedConversations: [] };
  },
  normalizeModelVariantSettings() {
    return false;
  },
};
