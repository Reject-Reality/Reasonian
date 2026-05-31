import type { ProviderConversationHistoryService } from '../../../core/providers/types';
import type { Conversation, ChatMessage } from '../../../core/types';

/**
 * Persistent message store for Reasonian.
 * Messages are saved alongside Claudian's session metadata using Obsidian's Vault adapter.
 */
export class ReasonixConversationHistoryService implements ProviderConversationHistoryService {
  /** Set by the plugin after initialization to provide vault filesystem access. */
  private vaultAdapter: { exists(path: string): Promise<boolean>; read(path: string): Promise<string>; write(path: string, data: string): Promise<void>; delete(path: string): Promise<void>; mkdir(path: string): Promise<void> } | null = null;

  setVaultAdapter(adapter: any): void {
    this.vaultAdapter = adapter;
  }

  private messagePath(sessionId: string): string {
    return `.reasonix/sessions/${sessionId}.messages.json`;
  }

  /** Ensure the parent directory for a file path exists. */
  private async ensureParentFolder(filePath: string): Promise<void> {
    if (!this.vaultAdapter) return;
    const folder = filePath.substring(0, filePath.lastIndexOf('/'));
    if (!folder) return;

    // Recursively ensure all parent directories exist
    const parts = folder.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      try {
        const exists = await this.vaultAdapter.exists(current);
        if (!exists) {
          await this.vaultAdapter.mkdir(current);
        }
      } catch {
        // Best-effort directory creation
      }
    }
  }

  async hydrateConversationHistory(
    conversation: Conversation,
    _vaultPath: string | null,
  ): Promise<void> {
    const sessionId = conversation.sessionId ?? conversation.id;
    if (!sessionId || !this.vaultAdapter) return;

    const filePath = this.messagePath(sessionId);
    try {
      const exists = await this.vaultAdapter.exists(filePath);
      if (exists) {
        const raw = await this.vaultAdapter.read(filePath);
        const messages = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(messages) && messages.length > 0) {
          conversation.messages = messages;
        }
      }
    } catch {
      // File doesn't exist or is corrupted — start fresh
    }
  }

  async deleteConversationSession(
    conversation: Conversation,
    _vaultPath: string | null,
  ): Promise<void> {
    const sessionId = conversation.sessionId ?? conversation.id;
    if (!sessionId || !this.vaultAdapter) return;

    const filePath = this.messagePath(sessionId);
    try {
      const exists = await this.vaultAdapter.exists(filePath);
      if (exists) {
        await this.vaultAdapter.delete(filePath);
      }
    } catch {
      // Best-effort deletion
    }
    conversation.messages = [];
  }

  /** Save messages via vault adapter. */
  async saveMessages(conversation: Conversation): Promise<void> {
    const sessionId = conversation.sessionId ?? conversation.id;
    if (!sessionId || !conversation.messages?.length || !this.vaultAdapter) return;

    const filePath = this.messagePath(sessionId);
    try {
      await this.ensureParentFolder(filePath);
      await this.vaultAdapter.write(filePath, JSON.stringify(conversation.messages, null, 2));
    } catch {
      // Best-effort save
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
