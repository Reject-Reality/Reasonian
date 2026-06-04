import type { ChatMessage } from 'reasonix';

import type {
  InlineEditRequest,
  InlineEditResult,
  InlineEditService,
} from '../../../core/providers/types';
import {
  buildInlineEditPrompt,
  getInlineEditSystemPrompt,
  parseInlineEditResponse,
} from '../../../core/prompt/inlineEdit';
import type ClaudianPlugin from '../../../main';
import { appendContextFiles } from '../../../utils/context';
import { runReasonixAuxiliaryChat } from './ReasonixAuxiliaryClient';

export class ReasonixInlineEditService implements InlineEditService {
  private controller: AbortController | null = null;
  private messages: ChatMessage[] = [];

  constructor(private readonly plugin: ClaudianPlugin) {}

  resetConversation(): void {
    this.cancel();
    this.messages = [];
  }

  async editText(request: InlineEditRequest): Promise<InlineEditResult> {
    this.cancel();
    this.messages = [{ role: 'user', content: buildInlineEditPrompt(request) }];

    return await this.run();
  }

  async continueConversation(
    message: string,
    contextFiles?: string[],
  ): Promise<InlineEditResult> {
    const content = contextFiles && contextFiles.length > 0
      ? appendContextFiles(message, contextFiles)
      : message;
    this.messages.push({ role: 'user', content });

    return await this.run();
  }

  cancel(): void {
    this.controller?.abort();
    this.controller = null;
  }

  private async run(): Promise<InlineEditResult> {
    const controller = new AbortController();
    this.controller = controller;

    try {
      const content = await runReasonixAuxiliaryChat(this.plugin, {
        system: getInlineEditSystemPrompt(),
        messages: this.messages,
        maxTokens: 2_000,
        temperature: 0.2,
        signal: controller.signal,
      });
      this.messages.push({ role: 'assistant', content });

      return parseInlineEditResponse(content);
    } catch (error) {
      if (controller.signal.aborted) {
        return { success: false, error: 'Cancelled' };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (this.controller === controller) {
        this.controller = null;
      }
    }
  }
}
