import { DeepSeekClient } from 'reasonix';
import type { ChatMessage } from 'reasonix';

import type ClaudianPlugin from '../../../main';
import {
  getReasonixProviderSettings,
  type ReasonixProviderSettings,
} from '../settings';

export interface ReasonixAuxiliaryChatOptions {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
  signal?: AbortSignal;
}

export function getReasonixAuxiliaryModel(
  plugin: ClaudianPlugin,
  preferredModel?: string,
): string {
  const settings = getReasonixProviderSettings(
    plugin.settings as unknown as Record<string, unknown>,
  );
  return preferredModel?.trim() || settings.model || 'deepseek-v4-flash';
}

export async function runReasonixAuxiliaryChat(
  plugin: ClaudianPlugin,
  options: ReasonixAuxiliaryChatOptions,
): Promise<string> {
  const settings = getReasonixProviderSettings(
    plugin.settings as unknown as Record<string, unknown>,
  );
  if (!settings.apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not set. Please add your API key in Reasonian settings.');
  }

  const client = new DeepSeekClient({
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl || undefined,
  });

  const response = await client.chat({
    model: options.model || getReasonixAuxiliaryModel(plugin),
    messages: [
      { role: 'system', content: options.system },
      ...options.messages,
    ],
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    reasoningEffort: settings.reasoningEffort as ReasonixProviderSettings['reasoningEffort'],
    signal: options.signal,
  });

  return response.content.trim();
}
