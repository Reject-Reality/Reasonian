import type { ChatMessage } from '../../src/core/types';
import { trimMessagesToAssistantCheckpoint } from '../../src/providers/reasonix/runtime/reasonixResumeCheckpoint';

function createMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: overrides.id ?? `msg-${Math.random().toString(36).slice(2)}`,
    role: overrides.role ?? 'user',
    content: overrides.content ?? '',
    timestamp: overrides.timestamp ?? Date.now(),
    ...overrides,
  };
}

describe('trimMessagesToAssistantCheckpoint', () => {
  it('keeps history through the requested assistant checkpoint only', () => {
    const messages: ChatMessage[] = [
      createMessage({ id: 'u1', role: 'user', userMessageId: 'reasonix:user-turn:0' }),
      createMessage({ id: 'a1', role: 'assistant', assistantMessageId: 'reasonix:assistant-turn:0' }),
      createMessage({ id: 'u2', role: 'user', userMessageId: 'reasonix:user-turn:1' }),
      createMessage({ id: 'a2', role: 'assistant', assistantMessageId: 'reasonix:assistant-turn:1' }),
      createMessage({ id: 'u3', role: 'user', userMessageId: 'reasonix:user-turn:2' }),
    ];

    expect(
      trimMessagesToAssistantCheckpoint(messages, 'reasonix:assistant-turn:0').map((message) => message.id),
    ).toEqual(['u1', 'a1']);
  });

  it('returns the original messages when the checkpoint is missing or undefined', () => {
    const messages: ChatMessage[] = [
      createMessage({ id: 'u1', role: 'user' }),
      createMessage({ id: 'a1', role: 'assistant', assistantMessageId: 'reasonix:assistant-turn:0' }),
    ];

    expect(trimMessagesToAssistantCheckpoint(messages, undefined)).toBe(messages);
    expect(trimMessagesToAssistantCheckpoint(messages, 'reasonix:assistant-turn:99')).toBe(messages);
  });
});
