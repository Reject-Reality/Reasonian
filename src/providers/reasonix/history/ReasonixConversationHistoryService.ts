import {
  loadSessionMessages,
  appendSessionMessage,
  deleteSession,
  listSessions,
} from 'reasonix';
import type { ProviderConversationHistoryService } from '../../../core/providers/types';
import type { Conversation } from '../../../core/types';

/** Bridges Claudian's Conversation metadata with Reasonix JSONL session storage. */
export class ReasonixConversationHistoryService implements ProviderConversationHistoryService {
  async hydrateConversationHistory(
    conversation: Conversation,
    _vaultPath: string | null,
  ): Promise<void> {
    const sessionId = conversation.sessionId ?? conversation.id;
    if (!sessionId) return;

    try {
      const messages = loadSessionMessages(sessionId);
      if (messages.length > 0) {
        conversation.messages = messages.map((msg, i) => ({
          id: `${sessionId}-${i}`,
          role: msg.role as 'user' | 'assistant',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          timestamp: Date.now() - (messages.length - i) * 1000,
        }));
      }
    } catch {
      // Session file doesn't exist or is corrupted — start fresh
    }
  }

  async deleteConversationSession(
    conversation: Conversation,
    _vaultPath: string | null,
  ): Promise<void> {
    const sessionId = conversation.sessionId ?? conversation.id;
    if (!sessionId) return;

    try {
      deleteSession(sessionId);
    } catch {
      // Best-effort deletion
    }
  }

  resolveSessionIdForConversation(conversation: Conversation | null): string | null {
    return conversation?.sessionId ?? conversation?.id ?? null;
  }

  isPendingForkConversation(_conversation: Conversation): boolean {
    return false;
  }

  buildForkProviderState(
    sourceSessionId: string,
    resumeAt: string,
    sourceProviderState?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      sourceSessionId,
      resumeAt,
      ...sourceProviderState,
    };
  }
}
