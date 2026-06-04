import type {
  TitleGenerationCallback,
  TitleGenerationService,
} from '../../../core/providers/types';
import { TITLE_GENERATION_SYSTEM_PROMPT } from '../../../core/prompt/titleGeneration';
import type ClaudianPlugin from '../../../main';
import { runReasonixAuxiliaryChat } from './ReasonixAuxiliaryClient';

export class ReasonixTitleGenerationService implements TitleGenerationService {
  private controllers = new Set<AbortController>();

  constructor(private readonly plugin: ClaudianPlugin) {}

  async generateTitle(
    conversationId: string,
    userMessage: string,
    callback: TitleGenerationCallback,
  ): Promise<void> {
    const controller = new AbortController();
    this.controllers.add(controller);

    try {
      const rawTitle = await runReasonixAuxiliaryChat(this.plugin, {
        system: TITLE_GENERATION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        model: this.plugin.settings.titleGenerationModel || undefined,
        maxTokens: 64,
        temperature: 0.2,
        signal: controller.signal,
      });
      const title = this.cleanTitle(rawTitle);
      await callback(
        conversationId,
        title
          ? { success: true, title }
          : { success: false, error: 'Empty title generated' },
      );
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      await callback(conversationId, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.controllers.delete(controller);
    }
  }

  cancel(): void {
    for (const controller of this.controllers) {
      controller.abort();
    }
    this.controllers.clear();
  }

  private cleanTitle(rawTitle: string): string {
    return rawTitle
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 50)
      .trim();
  }
}
