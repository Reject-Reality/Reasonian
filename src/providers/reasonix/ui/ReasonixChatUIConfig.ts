import type {
  ProviderChatUIConfig,
  ProviderIconSvg,
  ProviderPermissionModeToggleConfig,
  ProviderReasoningOption,
  ProviderServiceTierToggleConfig,
  ProviderUIOption,
} from '../../../core/providers/types';

// Diamond favicon from https://esengine.github.io/DeepSeek-Reasonix/ (18x18px)
const REASONIX_ICON: ProviderIconSvg = {
  viewBox: '0 0 64 64',
  path: 'M 32,21 L 43,32 L 32,43 L 21,32 Z',
};

const MODEL_OPTIONS: ProviderUIOption[] = [
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', description: 'Fast, cost-effective' },
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', description: 'Full power, thinking mode' },
];

const REASONING_OPTIONS: ProviderReasoningOption[] = [
  { value: 'low', label: 'Low', description: 'Minimal reasoning' },
  { value: 'medium', label: 'Medium', description: 'Balanced' },
  { value: 'high', label: 'High', description: 'Maximum reasoning depth' },
  { value: 'max', label: 'Max', description: 'DeepSeek extended reasoning (max)' },
];

const DEFAULT_CONTEXT_WINDOW = 128_000;

export const reasonixChatUIConfig: ProviderChatUIConfig = {
  getModelOptions(): ProviderUIOption[] {
    return MODEL_OPTIONS;
  },

  ownsModel(model: string): boolean {
    return model === 'deepseek-v4-flash' || model === 'deepseek-v4-pro';
  },

  isAdaptiveReasoningModel(): boolean {
    return false; // DeepSeek uses effort levels, not adaptive
  },

  getReasoningOptions(): ProviderReasoningOption[] {
    return REASONING_OPTIONS;
  },

  getDefaultReasoningValue(): string {
    return 'high';
  },

  getContextWindowSize(_model: string, customLimits?: Record<string, number>): number {
    return customLimits?.[_model] ?? DEFAULT_CONTEXT_WINDOW;
  },

  isDefaultModel(model: string): boolean {
    return model === 'deepseek-v4-flash';
  },

  applyModelDefaults(_model: string, _settings: unknown): void {},

  normalizeModelVariant(model: string): string {
    return model;
  },

  getCustomModelIds(): Set<string> {
    return new Set();
  },

  getProviderIcon(): ProviderIconSvg | null {
    return REASONIX_ICON;
  },

  // Permission mode toggle — yolo / auto / review / plan (Reasonix edit modes)
  getPermissionModeToggle(): ProviderPermissionModeToggleConfig | null {
    return {
      inactiveValue: 'normal',
      inactiveLabel: 'Review',
      activeValue: 'yolo',
      activeLabel: 'YOLO',
      planValue: 'plan',
      planLabel: 'Plan',
    };
  },

  // No separate service tier for DeepSeek
  getServiceTierToggle(_settings: Record<string, unknown>): ProviderServiceTierToggleConfig | null {
    return null;
  },
};
