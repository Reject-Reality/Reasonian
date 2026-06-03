import { getProviderConfig, setProviderConfig } from '../../core/providers/providerConfig';

export type ReasonixSafeMode = 'acceptEdits' | 'default';

export interface ReasonixProviderSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  reasoningEffort: 'low' | 'medium' | 'high' | 'max';
  maxOutputTokens: number;
  budgetUsd: number | null;
  maxIterPerTurn: number;
  lastModel: string;
  environmentVariables: string;
  environmentHash: string;
  memoryEnabled: boolean;
  projectMemoryRoot: string;
  memoryHomeDir: string;
  webToolsEnabled: boolean;
}

export const DEFAULT_REASONIX_PROVIDER_SETTINGS: Readonly<ReasonixProviderSettings> = Object.freeze({
  apiKey: '',
  baseUrl: '',
  model: 'deepseek-v4-flash',
  reasoningEffort: 'high',
  maxOutputTokens: 0,
  budgetUsd: null,
  maxIterPerTurn: 50,
  lastModel: 'deepseek-v4-flash',
  environmentVariables: '',
  environmentHash: '',
  memoryEnabled: true,
  projectMemoryRoot: '',
  memoryHomeDir: '',
  webToolsEnabled: false,
});

export function getReasonixProviderSettings(
  settings: Record<string, unknown>,
): ReasonixProviderSettings {
  const config = getProviderConfig(settings, 'reasonix');

  return {
    apiKey: (config.apiKey as string) ?? DEFAULT_REASONIX_PROVIDER_SETTINGS.apiKey,
    baseUrl: (config.baseUrl as string) ?? DEFAULT_REASONIX_PROVIDER_SETTINGS.baseUrl,
    model: (config.model as string) ?? DEFAULT_REASONIX_PROVIDER_SETTINGS.model,
    reasoningEffort: (config.reasoningEffort as ReasonixProviderSettings['reasoningEffort'])
      ?? DEFAULT_REASONIX_PROVIDER_SETTINGS.reasoningEffort,
    maxOutputTokens: (config.maxOutputTokens as number)
      ?? DEFAULT_REASONIX_PROVIDER_SETTINGS.maxOutputTokens,
    budgetUsd: (config.budgetUsd as number | null)
      ?? DEFAULT_REASONIX_PROVIDER_SETTINGS.budgetUsd,
    maxIterPerTurn: (config.maxIterPerTurn as number)
      ?? DEFAULT_REASONIX_PROVIDER_SETTINGS.maxIterPerTurn,
    lastModel: (config.lastModel as string) ?? DEFAULT_REASONIX_PROVIDER_SETTINGS.lastModel,
    environmentVariables: (config.environmentVariables as string)
      ?? DEFAULT_REASONIX_PROVIDER_SETTINGS.environmentVariables,
    environmentHash: (config.environmentHash as string)
      ?? DEFAULT_REASONIX_PROVIDER_SETTINGS.environmentHash,
    memoryEnabled: (config.memoryEnabled as boolean)
      ?? DEFAULT_REASONIX_PROVIDER_SETTINGS.memoryEnabled,
    projectMemoryRoot: (config.projectMemoryRoot as string)
      ?? DEFAULT_REASONIX_PROVIDER_SETTINGS.projectMemoryRoot,
    memoryHomeDir: (config.memoryHomeDir as string)
      ?? DEFAULT_REASONIX_PROVIDER_SETTINGS.memoryHomeDir,
    webToolsEnabled: (config.webToolsEnabled as boolean)
      ?? DEFAULT_REASONIX_PROVIDER_SETTINGS.webToolsEnabled,
  };
}

export function updateReasonixProviderSettings(
  settings: Record<string, unknown>,
  updates: Partial<ReasonixProviderSettings>,
): ReasonixProviderSettings {
  const next = {
    ...getReasonixProviderSettings(settings),
    ...updates,
  };
  setProviderConfig(settings, 'reasonix', next as unknown as Record<string, unknown>);
  return next;
}
