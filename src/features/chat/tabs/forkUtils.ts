import type { ChatMessage } from '../../../core/types';
import { findRewindContext } from '../rewind';

const MAX_FORK_TITLE_LENGTH = 50;
const FORK_TITLE_PREFIX = 'Fork: ';

export interface ForkAtUserMessageSnapshot {
  messages: ChatMessage[];
  resumeAt: string;
  forkAtUserMessage: number;
}

export interface ForkAllSnapshot {
  messages: ChatMessage[];
  resumeAt: string;
  forkAtUserMessage: number;
}

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

export function buildForkAtUserMessageSnapshot(
  messages: ChatMessage[],
  userIndex: number,
): ForkAtUserMessageSnapshot | null {
  if (userIndex < 0 || userIndex >= messages.length) {
    return null;
  }

  const rewindContext = findRewindContext(messages, userIndex);
  if (!rewindContext.hasResponse || !rewindContext.prevAssistantUuid) {
    return null;
  }

  return {
    messages: messages.slice(0, userIndex),
    resumeAt: rewindContext.prevAssistantUuid,
    forkAtUserMessage: countUserMessagesForForkTitle(messages.slice(0, userIndex + 1)),
  };
}

export function buildForkAllSnapshot(messages: ChatMessage[]): ForkAllSnapshot | null {
  let lastAssistantUuid: string | undefined;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'assistant' && messages[index].assistantMessageId) {
      lastAssistantUuid = messages[index].assistantMessageId;
      break;
    }
  }

  if (!lastAssistantUuid) {
    return null;
  }

  return {
    messages: messages.slice(),
    resumeAt: lastAssistantUuid,
    forkAtUserMessage: countUserMessagesForForkTitle(messages) + 1,
  };
}
