import type { InstructionRefineService, RefineProgressCallback } from '../../../core/providers/types';
import type { InstructionRefineResult } from '../../../core/types/settings';

/** Stub — will be fully implemented in Step 7. */
export class ReasonixInstructionRefineService implements InstructionRefineService {
  resetConversation(): void {}
  refineInstruction(_raw: string, _existing: string, _onProgress?: RefineProgressCallback): Promise<InstructionRefineResult> {
    return Promise.resolve({ success: false, error: 'Not yet implemented' });
  }
  continueConversation(_message: string, _onProgress?: RefineProgressCallback): Promise<InstructionRefineResult> {
    return Promise.resolve({ success: false, error: 'Not yet implemented' });
  }
  cancel(): void {}
}
