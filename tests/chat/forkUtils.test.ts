import type { ChatMessage } from '../../src/core/types';
import {
  buildForkAllSnapshot,
  buildForkAtUserMessageSnapshot,
  buildForkTitle,
  countUserMessagesForForkTitle,
} from '../../src/features/chat/tabs/forkUtils';

function createMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: overrides.id ?? `msg-${Math.random().toString(36).slice(2)}`,
    role: overrides.role ?? 'user',
    content: overrides.content ?? '',
    timestamp: overrides.timestamp ?? Date.now(),
    ...overrides,
  };
}

describe('forkUtils', () => {
  describe('countUserMessagesForForkTitle', () => {
    it('counts only semantic user messages', () => {
      const messages: ChatMessage[] = [
        createMessage({ role: 'user', content: 'first' }),
        createMessage({ role: 'assistant', content: 'reply' }),
        createMessage({ role: 'user', content: 'interrupt', isInterrupt: true }),
        createMessage({ role: 'user', content: 'rebuilt', isRebuiltContext: true }),
        createMessage({ role: 'user', content: 'second' }),
      ];

      expect(countUserMessagesForForkTitle(messages)).toBe(2);
    });
  });

  describe('buildForkTitle', () => {
    it('builds a fork title with an optional user-turn suffix', () => {
      expect(buildForkTitle('Project plan', [], 3)).toBe('Fork: Project plan (#3)');
      expect(buildForkTitle('Project plan', [], undefined)).toBe('Fork: Project plan');
    });

    it('truncates long titles to the maximum visible length', () => {
      const sourceTitle = 'A'.repeat(80);
      const title = buildForkTitle(sourceTitle, [], 12);

      expect(title.length).toBeLessThanOrEqual(50);
      expect(title.startsWith('Fork: ')).toBe(true);
      expect(title.endsWith(' (#12)')).toBe(true);
      expect(title).toContain('…');
    });

    it('deduplicates against existing conversation titles', () => {
      const existingTitles = [
        'Fork: Project plan (#2)',
        'Fork: Project plan (#2) 2',
      ];

      expect(buildForkTitle('Project plan', existingTitles, 2)).toBe('Fork: Project plan (#2) 3');
    });
  });

  describe('buildForkAtUserMessageSnapshot', () => {
    it('cuts messages before the selected user turn and uses the previous assistant checkpoint', () => {
      const messages: ChatMessage[] = [
        createMessage({ id: 'u1', role: 'user', content: 'first', userMessageId: 'reasonix:user-turn:0' }),
        createMessage({ id: 'a1', role: 'assistant', content: 'reply1', assistantMessageId: 'reasonix:assistant-turn:0' }),
        createMessage({ id: 'u2', role: 'user', content: 'second', userMessageId: 'reasonix:user-turn:1' }),
        createMessage({ id: 'a2', role: 'assistant', content: 'reply2', assistantMessageId: 'reasonix:assistant-turn:1' }),
      ];

      expect(buildForkAtUserMessageSnapshot(messages, 2)).toEqual({
        messages: messages.slice(0, 2),
        resumeAt: 'reasonix:assistant-turn:0',
        forkAtUserMessage: 2,
      });
    });

    it('returns null when the selected turn has no completed assistant response', () => {
      const messages: ChatMessage[] = [
        createMessage({ id: 'u1', role: 'user', content: 'first', userMessageId: 'reasonix:user-turn:0' }),
        createMessage({ id: 'a1', role: 'assistant', content: 'reply1', assistantMessageId: 'reasonix:assistant-turn:0' }),
        createMessage({ id: 'u2', role: 'user', content: 'second', userMessageId: 'reasonix:user-turn:1' }),
        createMessage({ id: 'u3', role: 'user', content: 'third', userMessageId: 'reasonix:user-turn:2' }),
      ];

      expect(buildForkAtUserMessageSnapshot(messages, 2)).toBeNull();
      expect(buildForkAtUserMessageSnapshot(messages, -1)).toBeNull();
    });
  });

  describe('buildForkAllSnapshot', () => {
    it('forks all messages from the latest assistant checkpoint and next user index', () => {
      const messages: ChatMessage[] = [
        createMessage({ role: 'user', content: 'first', userMessageId: 'reasonix:user-turn:0' }),
        createMessage({ role: 'assistant', content: 'reply1', assistantMessageId: 'reasonix:assistant-turn:0' }),
        createMessage({ role: 'user', content: 'second', userMessageId: 'reasonix:user-turn:1' }),
        createMessage({ role: 'assistant', content: 'reply2', assistantMessageId: 'reasonix:assistant-turn:1' }),
      ];

      expect(buildForkAllSnapshot(messages)).toEqual({
        messages,
        resumeAt: 'reasonix:assistant-turn:1',
        forkAtUserMessage: 3,
      });
    });

    it('returns null when no assistant checkpoint exists', () => {
      const messages: ChatMessage[] = [
        createMessage({ role: 'user', content: 'only user', userMessageId: 'reasonix:user-turn:0' }),
      ];

      expect(buildForkAllSnapshot(messages)).toBeNull();
    });
  });
});
