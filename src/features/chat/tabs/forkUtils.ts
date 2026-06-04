import type { ChatMessage } from '../../../core/types';

const MAX_FORK_TITLE_LENGTH = 50;
const FORK_TITLE_PREFIX = 'Fork: ';

export function countUserMessagesForForkTitle(messages: ChatMessage[]): number {
  // Keep fork numbering stable by excluding non-semantic user messages.
  return messages.filter((message) =>
    message.role === 'user' && !message.isInterrupt && !message.isRebuiltContext
  ).length;
}

export function buildForkTitle(
  sourceTitle: string,
  existingTitles: Iterable<string>,
  forkAtUserMessage?: number,
): string {
  const forkSuffix = forkAtUserMessage ? ` (#${forkAtUserMessage})` : '';
  const maxSourceLength = MAX_FORK_TITLE_LENGTH - FORK_TITLE_PREFIX.length - forkSuffix.length;
  const truncatedSource = sourceTitle.length > maxSourceLength
    ? sourceTitle.slice(0, maxSourceLength - 1) + '…'
    : sourceTitle;
  let title = FORK_TITLE_PREFIX + truncatedSource + forkSuffix;

  const existingTitleSet = new Set(existingTitles);
  if (existingTitleSet.has(title)) {
    let duplicateIndex = 2;
    while (existingTitleSet.has(`${title} ${duplicateIndex}`)) {
      duplicateIndex += 1;
    }
    title = `${title} ${duplicateIndex}`;
  }

  return title;
}
