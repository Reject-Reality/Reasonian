import type { ProviderTaskResultInterpreter, ProviderTaskTerminalStatus } from '../../../core/providers/types';

/** Stub — will be fully implemented in Step 5. */
export class ReasonixTaskResultInterpreter implements ProviderTaskResultInterpreter {
  hasAsyncLaunchMarker(): boolean { return false; }
  extractAgentId(): string | null { return null; }
  extractStructuredResult(): string | null { return null; }
  resolveTerminalStatus(_: unknown, fallback: ProviderTaskTerminalStatus): ProviderTaskTerminalStatus {
    return fallback;
  }
  extractTagValue(): string | null { return null; }
}
