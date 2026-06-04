import { findRewindContext } from '../../src/features/chat/rewind';
import type { ChatMessage } from '../../src/core/types';

function createMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: overrides.id ?? `msg-${Math.random().toString(36).slice(2)}`,
    role: overrides.role ?? 'user',
    content: overrides.content ?? '',
    timestamp: overrides.timestamp ?? Date.now(),
    ...overrides,
  };
}

describe('findRewindContext', () => {
  it('finds the previous assistant checkpoint and confirms a later response exists', () => {
    const messages: ChatMessage[] = [
      createMessage({ id: 'u1', role: 'user', userMessageId: 'reasonix:user-turn:0' }),
      createMessage({ id: 'a1', role: 'assistant', assistantMessageId: 'reasonix:assistant-turn:0' }),
      createMessage({ id: 'u2', role: 'user', userMessageId: 'reasonix:user-turn:1' }),
      createMessage({ id: 'a2', role: 'assistant', assistantMessageId: 'reasonix:assistant-turn:1' }),
    ];

    expect(findRewindContext(messages, 2)).toEqual({
      prevAssistantUuid: 'reasonix:assistant-turn:0',
      hasResponse: true,
    });
  });

  it('stops searching for a response when the next user turn is reached', () => {
    const messages: ChatMessage[] = [
      createMessage({ id: 'u1', role: 'user', userMessageId: 'reasonix:user-turn:0' }),
      createMessage({ id: 'a1', role: 'assistant', assistantMessageId: 'reasonix:assistant-turn:0' }),
      createMessage({ id: 'u2', role: 'user', userMessageId: 'reasonix:user-turn:1' }),
      createMessage({ id: 'u3', role: 'user', userMessageId: 'reasonix:user-turn:2' }),
      createMessage({ id: 'a3', role: 'assistant', assistantMessageId: 'reasonix:assistant-turn:2' }),
    ];

    expect(findRewindContext(messages, 2)).toEqual({
      prevAssistantUuid: 'reasonix:assistant-turn:0',
      hasResponse: false,
    });
  });

  it('returns undefined checkpoint when no prior assistant checkpoint exists', () => {
    const messages: ChatMessage[] = [
      createMessage({ id: 'u1', role: 'user', userMessageId: 'reasonix:user-turn:0' }),
      createMessage({ id: 'a1', role: 'assistant', content: 'streaming only' }),
    ];

    expect(findRewindContext(messages, 0)).toEqual({
      prevAssistantUuid: undefined,
      hasResponse: false,
    });
  });
});
