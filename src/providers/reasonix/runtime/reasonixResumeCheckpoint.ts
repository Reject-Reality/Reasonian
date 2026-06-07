import type { ChatMessage } from '../../../core/types';

export function trimMessagesToAssistantCheckpoint(
  messages: ChatMessage[],
  checkpointId: string | undefined,
): ChatMessage[] {
  if (!checkpointId) {
    return messages;
  }

  const checkpointIndex = messages.findIndex(
    (message) => message.role === 'assistant' && message.assistantMessageId === checkpointId,
  );
  if (checkpointIndex === -1) {
    return messages;
  }

  return messages.slice(0, checkpointIndex + 1);
}
