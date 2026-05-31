import type { InlineEditService, InlineEditRequest, InlineEditResult } from '../../../core/providers/types';

/** Stub — will be fully implemented in Step 7. */
export class ReasonixInlineEditService implements InlineEditService {
  resetConversation(): void {}
  editText(_request: InlineEditRequest): Promise<InlineEditResult> {
    return Promise.resolve({ success: false, error: 'Not yet implemented' });
  }
  continueConversation(_message: string, _contextFiles?: string[]): Promise<InlineEditResult> {
    return Promise.resolve({ success: false, error: 'Not yet implemented' });
  }
  cancel(): void {}
}
