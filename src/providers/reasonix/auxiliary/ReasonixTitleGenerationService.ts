import type { TitleGenerationService, TitleGenerationCallback } from '../../../core/providers/types';

/** Stub — will be fully implemented in Step 7. */
export class ReasonixTitleGenerationService implements TitleGenerationService {
  generateTitle(_conversationId: string, _userMessage: string, _callback: TitleGenerationCallback): Promise<void> {
    return Promise.resolve();
  }
  cancel(): void {}
}
