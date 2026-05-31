import type { ProviderRegistration } from '../../core/providers/types';
import { ReasonixInlineEditService } from './auxiliary/ReasonixInlineEditService';
import { ReasonixInstructionRefineService } from './auxiliary/ReasonixInstructionRefineService';
import { ReasonixTitleGenerationService } from './auxiliary/ReasonixTitleGenerationService';
import { REASONIX_PROVIDER_CAPABILITIES } from './capabilities';
import { reasonixSettingsReconciler } from './env/ReasonixSettingsReconciler';
import { ReasonixConversationHistoryService } from './history/ReasonixConversationHistoryService';
import { ReasonixChatRuntime } from './runtime/ReasonixChatRuntime';
import { ReasonixTaskResultInterpreter } from './runtime/ReasonixTaskResultInterpreter';
import { reasonixChatUIConfig } from './ui/ReasonixChatUIConfig';

export const reasonixProviderRegistration: ProviderRegistration = {
  displayName: 'Reasonix',
  blankTabOrder: 10,
  isEnabled: () => true,
  capabilities: REASONIX_PROVIDER_CAPABILITIES,
  environmentKeyPatterns: [/^DEEPSEEK_/i, /^REASONIX_/i],
  chatUIConfig: reasonixChatUIConfig,
  settingsReconciler: reasonixSettingsReconciler,
  createRuntime: ({ plugin }) => {
    const runtime = new ReasonixChatRuntime();
    runtime.setPlugin(plugin);
    return runtime;
  },
  createTitleGenerationService: (_plugin) => new ReasonixTitleGenerationService(),
  createInstructionRefineService: (_plugin) => new ReasonixInstructionRefineService(),
  createInlineEditService: (_plugin) => new ReasonixInlineEditService(),
  historyService: new ReasonixConversationHistoryService(),
  taskResultInterpreter: new ReasonixTaskResultInterpreter(),
};
