import type { ProviderConversationHistoryService, ProviderTaskResultInterpreter } from '../../../core/providers/types';

/** Stub — will be fully implemented in Step 4. */
export class ReasonixConversationHistoryService implements ProviderConversationHistoryService {
  hydrateConversationHistory(): Promise<void> { return Promise.resolve(); }
  deleteConversationSession(): Promise<void> { return Promise.resolve(); }
  resolveSessionIdForConversation(): string | null { return null; }
  isPendingForkConversation(): boolean { return false; }
  buildForkProviderState(): Record<string, unknown> { return {}; }
}
