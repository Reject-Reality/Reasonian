import { getDefaultHiddenProviderCommands } from '../../core/providers/commands/hiddenCommands';
import { type ClaudianSettings } from '../../core/types/settings';
import { DEFAULT_REASONIX_PROVIDER_SETTINGS } from '../../providers/reasonix/settings';

export const DEFAULT_CLAUDIAN_SETTINGS: ClaudianSettings = {
  userName: '',

  permissionMode: 'yolo',

  model: 'deepseek-v4-flash',
  thinkingBudget: 'off',
  effortLevel: 'high',
  serviceTier: 'default',
  enableAutoTitleGeneration: true,
  titleGenerationModel: '',

  excludedTags: [],
  mediaFolder: '',
  systemPrompt: '',
  persistentExternalContextPaths: [],

  sharedEnvironmentVariables: '',
  envSnippets: [],
  customContextLimits: {},

  keyboardNavigation: {
    scrollUpKey: 'w',
    scrollDownKey: 's',
    focusInputKey: 'i',
  },

  locale: 'en',

  providerConfigs: {
    reasonix: { ...DEFAULT_REASONIX_PROVIDER_SETTINGS },
  },

  settingsProvider: 'reasonix',
  savedProviderModel: {},
  savedProviderEffort: {},
  savedProviderServiceTier: {},
  savedProviderThinkingBudget: {},

  lastCustomModel: '',

  maxTabs: 3,
  tabBarPosition: 'input',
  enableAutoScroll: true,
  openInMainTab: false,

  hiddenProviderCommands: getDefaultHiddenProviderCommands(),
};
