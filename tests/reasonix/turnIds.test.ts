import type { ChatMessage } from '../../src/core/types';
import {
  countReasonixUserTurns,
  ensureReasonixTurnIds,
  isReasonixAssistantTurnId,
  isReasonixLocalSdkCommandUserMessage,
  isReasonixUserTurnMessage,
  parseReasonixUserTurnIndex,
} from '../../src/providers/reasonix/turnIds';

function createMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: overrides.id ?? `msg-${Math.random().toString(36).slice(2)}`,
    role: overrides.role ?? 'user',
    content: overrides.content ?? '',
    timestamp: overrides.timestamp ?? Date.now(),
    ...overrides,
  };
}

describe('reasonix turn id helpers', () => {
  it('detects local sdk command messages from displayContent and content', () => {
    expect(isReasonixLocalSdkCommandUserMessage(
      createMessage({ role: 'user', content: '/status' }),
    )).toBe(true);

    expect(isReasonixLocalSdkCommandUserMessage(
      createMessage({ role: 'user', content: 'expanded prompt', displayContent: '/memory project/list' }),
    )).toBe(true);

    expect(isReasonixLocalSdkCommandUserMessage(
      createMessage({ role: 'assistant', content: '/status' }),
    )).toBe(false);

    expect(isReasonixLocalSdkCommandUserMessage(
      createMessage({ role: 'user', content: '/custom-command' }),
    )).toBe(false);
  });

  it('counts only semantic user turns', () => {
    const messages: ChatMessage[] = [
      createMessage({ role: 'user', content: 'real user turn' }),
      createMessage({ role: 'assistant', content: 'assistant' }),
      createMessage({ role: 'user', content: '/status' }),
      createMessage({ role: 'user', content: 'interrupt', isInterrupt: true }),
      createMessage({ role: 'user', content: 'second real turn' }),
    ];

    expect(isReasonixUserTurnMessage(messages[0])).toBe(true);
    expect(isReasonixUserTurnMessage(messages[2])).toBe(false);
    expect(isReasonixUserTurnMessage(messages[3])).toBe(false);
    expect(countReasonixUserTurns(messages)).toBe(2);
  });

  it('assigns stable turn ids only to semantic user turns and following assistants', () => {
    const messages: ChatMessage[] = [
      createMessage({ id: 'u1', role: 'user', content: 'hello' }),
      createMessage({ id: 'a1', role: 'assistant', content: 'world' }),
      createMessage({ id: 'u2', role: 'user', content: '/status' }),
      createMessage({ id: 'u3', role: 'user', content: 'follow-up' }),
      createMessage({ id: 'a3', role: 'assistant', content: 'done' }),
    ];

    expect(ensureReasonixTurnIds(messages)).toBe(true);
    expect(messages[0].userMessageId).toBe('reasonix:user-turn:0');
    expect(messages[1].assistantMessageId).toBe('reasonix:assistant-turn:0');
    expect(messages[2].userMessageId).toBeUndefined();
    expect(messages[3].userMessageId).toBe('reasonix:user-turn:1');
    expect(messages[4].assistantMessageId).toBe('reasonix:assistant-turn:1');
    expect(ensureReasonixTurnIds(messages)).toBe(false);
  });

  it('parses and validates persisted turn id formats', () => {
    expect(parseReasonixUserTurnIndex('reasonix:user-turn:0')).toBe(0);
    expect(parseReasonixUserTurnIndex('reasonix:user-turn:12')).toBe(12);
    expect(parseReasonixUserTurnIndex('reasonix:user-turn:-1')).toBeNull();
    expect(parseReasonixUserTurnIndex('reasonix-user-1')).toBeNull();
    expect(isReasonixAssistantTurnId('reasonix:assistant-turn:2')).toBe(true);
    expect(isReasonixAssistantTurnId('reasonix:user-turn:2')).toBe(false);
  });
});
