import type {
  ProviderChatUIConfig,
  ProviderIconSvg,
  ProviderReasoningOption,
  ProviderUIOption,
} from '../../../core/providers/types';

const REASONIX_ICON: ProviderIconSvg = {
  viewBox: '0 0 1254 1254',
  path: 'M365.68 979.74l-25.49-38.96c-6.04-.37-11.31-.37-17.43.02l-.32 38.89-25.45-.07.17-116.94 41.97-.09c8.63-.02 17.06-.36 25.04 2.45 16 4.84 25.56 18.48 25.9 34.98s-8.99 30.24-24.61 36.54l29.2 42.77-28.97.42zM349.06 918.57c10.12-1.14 15.92-8.96 15.42-18.1-.45-8.24-7.17-15.04-16.43-15.27-8.58-.22-16.84-.16-25.42.11l.2 33.63c9-.35 17.44.61 26.23-.38z',
};

const MODEL_OPTIONS: ProviderUIOption[] = [
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', description: 'Fast, cost-effective' },
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', description: 'Full power, thinking mode' },
];

const REASONING_OPTIONS: ProviderReasoningOption[] = [
  { value: 'low', label: 'Low', tokens: 0 },
  { value: 'medium', label: 'Medium', tokens: 0 },
  { value: 'high', label: 'High', tokens: 0 },
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
};
