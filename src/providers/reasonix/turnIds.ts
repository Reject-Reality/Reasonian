import type { ChatMessage } from '../../core/types';

const USER_TURN_ID_PREFIX = 'reasonix:user-turn:';
const ASSISTANT_TURN_ID_PREFIX = 'reasonix:assistant-turn:';
const LOCAL_SDK_COMMAND_NAMES = new Set([
  'compact',
  'status',
  'context',
  'mcp',
  'memory',
  'help',
  'model',
  'effort',
  'max-tokens',
  'budget',
]);

export function makeReasonixUserTurnId(turnIndex: number): string {
  return `${USER_TURN_ID_PREFIX}${turnIndex}`;
}

export function makeReasonixAssistantTurnId(turnIndex: number): string {
  return `${ASSISTANT_TURN_ID_PREFIX}${turnIndex}`;
}

export function parseReasonixUserTurnIndex(id: string | undefined): number | null {
  if (!id?.startsWith(USER_TURN_ID_PREFIX)) {
    return null;
  }

  const value = Number.parseInt(id.slice(USER_TURN_ID_PREFIX.length), 10);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function isReasonixAssistantTurnId(id: string | undefined): boolean {
  return id?.startsWith(ASSISTANT_TURN_ID_PREFIX) === true;
}

export function isReasonixLocalSdkCommandUserMessage(message: ChatMessage): boolean {
  if (message.role !== 'user') {
    return false;
  }

  const text = (message.displayContent ?? message.content).trim();
  const match = /^\/([a-zA-Z0-9][a-zA-Z0-9._-]*)(?:\s|$)/.exec(text);
  return match ? LOCAL_SDK_COMMAND_NAMES.has(match[1].toLowerCase()) : false;
}

export function isReasonixUserTurnMessage(message: ChatMessage): boolean {
  return message.role === 'user'
    && message.isInterrupt !== true
    && !isReasonixLocalSdkCommandUserMessage(message);
}

export function countReasonixUserTurns(messages: ChatMessage[] | undefined): number {
  return (messages ?? []).filter(isReasonixUserTurnMessage).length;
}

export function ensureReasonixTurnIds(messages: ChatMessage[]): boolean {
  let changed = false;
  let currentTurnIndex = -1;

  for (const message of messages) {
    if (message.role === 'user') {
      if (!isReasonixUserTurnMessage(message)) {
        continue;
      }

      currentTurnIndex += 1;
      if (!message.userMessageId) {
        message.userMessageId = makeReasonixUserTurnId(currentTurnIndex);
        changed = true;
      }
      continue;
    }

    if (message.role === 'assistant' && currentTurnIndex >= 0 && !message.assistantMessageId) {
      message.assistantMessageId = makeReasonixAssistantTurnId(currentTurnIndex);
      changed = true;
    }
  }

  return changed;
}
