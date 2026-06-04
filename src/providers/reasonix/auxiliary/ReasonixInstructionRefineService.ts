import type { ChatMessage } from 'reasonix';

import type {
  InstructionRefineService,
  RefineProgressCallback,
} from '../../../core/providers/types';
import { buildRefineSystemPrompt } from '../../../core/prompt/instructionRefine';
import type { InstructionRefineResult } from '../../../core/types/settings';
import type ClaudianPlugin from '../../../main';
import { runReasonixAuxiliaryChat } from './ReasonixAuxiliaryClient';

export class ReasonixInstructionRefineService implements InstructionRefineService {
  private controller: AbortController | null = null;
  private systemPrompt = '';
  private messages: ChatMessage[] = [];

  constructor(private readonly plugin: ClaudianPlugin) {}

  resetConversation(): void {
    this.cancel();
    this.systemPrompt = '';
    this.messages = [];
  }

  async refineInstruction(
    rawInstruction: string,
    existingInstructions: string,
    onProgress?: RefineProgressCallback,
  ): Promise<InstructionRefineResult> {
    this.cancel();
    this.systemPrompt = buildRefineSystemPrompt(existingInstructions);
    this.messages = [{ role: 'user', content: rawInstruction }];

    return await this.run(onProgress);
  }

  async continueConversation(
    message: string,
    onProgress?: RefineProgressCallback,
  ): Promise<InstructionRefineResult> {
    if (!this.systemPrompt) {
      this.systemPrompt = buildRefineSystemPrompt('');
    }
    this.messages.push({ role: 'user', content: message });

    return await this.run(onProgress);
  }

  cancel(): void {
    this.controller?.abort();
    this.controller = null;
  }

  private async run(
    onProgress?: RefineProgressCallback,
  ): Promise<InstructionRefineResult> {
    const controller = new AbortController();
    this.controller = controller;

    try {
      const content = await runReasonixAuxiliaryChat(this.plugin, {
        system: this.systemPrompt,
        messages: this.messages,
        maxTokens: 1_200,
        temperature: 0.2,
        signal: controller.signal,
      });
      this.messages.push({ role: 'assistant', content });

      const result = this.parseResponse(content);
      onProgress?.(result);
      return result;
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

  private parseResponse(responseText: string): InstructionRefineResult {
    const instructionMatch = responseText.match(/<instruction>([\s\S]*?)<\/instruction>/i);
    if (instructionMatch) {
      const refinedInstruction = instructionMatch[1].trim();
      return refinedInstruction
        ? { success: true, refinedInstruction }
        : { success: false, error: 'Empty refined instruction' };
    }

    const clarification = responseText.trim();
    return clarification
      ? { success: true, clarification }
      : { success: false, error: 'Empty response' };
  }
}
