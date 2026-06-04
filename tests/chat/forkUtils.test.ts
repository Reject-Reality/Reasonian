import type { ChatMessage } from '../../src/core/types';
import {
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
});
