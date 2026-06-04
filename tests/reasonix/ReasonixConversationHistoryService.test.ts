import { ReasonixConversationHistoryService } from '../../src/providers/reasonix/history/ReasonixConversationHistoryService';
import type { Conversation } from '../../src/core/types';

type VaultAdapterLike = {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, data: string): Promise<void>;
  delete(path: string): Promise<void>;
  mkdir(path: string): Promise<void>;
};

function createConversation(): Conversation {
  return {
    id: 'conv-1',
    providerId: 'reasonix',
    title: 'Test conversation',
    createdAt: 1,
    updatedAt: 1,
    sessionId: 'session-1',
    messages: [],
  };
}

function createAdapter(overrides: Partial<VaultAdapterLike> = {}): VaultAdapterLike {
  return {
    exists: async () => true,
    read: async () => '[]',
    write: async () => undefined,
    delete: async () => undefined,
    mkdir: async () => undefined,
    ...overrides,
  };
}

describe('ReasonixConversationHistoryService', () => {
  it('hydrates persisted messages and ensures turn ids', async () => {
    const service = new ReasonixConversationHistoryService();
    const conversation = createConversation();
    service.setVaultAdapter(createAdapter({
      read: async () => JSON.stringify([
        {
          id: 'user-1',
          role: 'user',
          content: 'hello',
          timestamp: 1,
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'world',
          timestamp: 2,
        },
      ]),
    }));

    await service.hydrateConversationHistory(conversation, null);

    expect(conversation.messages).toHaveLength(2);
    expect(conversation.messages[0]?.userMessageId).toBe('reasonix:user-turn:0');
    expect(conversation.messages[1]?.assistantMessageId).toBe('reasonix:assistant-turn:0');
    expect(conversation.providerState).toBeUndefined();
  });

  it('flags corrupted session history and falls back to empty messages', async () => {
    const service = new ReasonixConversationHistoryService();
    const conversation = createConversation();
    service.setVaultAdapter(createAdapter({
      read: async () => '{broken json',
    }));

    await service.hydrateConversationHistory(conversation, null);

    expect(conversation.messages).toEqual([]);
    expect(conversation.providerState?.reasonixHistoryRecoveryWarning).toContain(
      '.reasonix/sessions/session-1.messages.json',
    );
    expect(conversation.providerState?.reasonixHistoryRecoveryWarning).toContain(
      'could not be loaded',
    );
  });

  it('strips transient recovery warnings from persisted provider state', () => {
    const service = new ReasonixConversationHistoryService();
    const conversation = createConversation();
    conversation.providerState = {
      reasonixHistoryRecoveryWarning: 'temporary warning',
      anotherFlag: true,
    };

    const persisted = service.buildPersistedProviderState(conversation);

    expect(persisted).toEqual({
      conversationId: 'conv-1',
      anotherFlag: true,
    });
  });

  it('creates parent folders and writes messages when saving a session', async () => {
    const service = new ReasonixConversationHistoryService();
    const mkdirCalls: string[] = [];
    const writeCalls: Array<{ path: string; data: string }> = [];
    const existingPaths = new Set<string>();

    service.setVaultAdapter(createAdapter({
      exists: async (path) => existingPaths.has(path),
      mkdir: async (path) => {
        mkdirCalls.push(path);
        existingPaths.add(path);
      },
      write: async (path, data) => {
        writeCalls.push({ path, data });
      },
    }));

    const conversation = createConversation();
    conversation.messages = [
      {
        id: 'user-1',
        role: 'user',
        content: 'save me',
        timestamp: 1,
      },
    ];

    await service.saveMessages(conversation);

    expect(mkdirCalls).toEqual(['.reasonix', '.reasonix/sessions']);
    expect(writeCalls).toHaveLength(1);
    expect(writeCalls[0]?.path).toBe('.reasonix/sessions/session-1.messages.json');
    expect(JSON.parse(writeCalls[0]?.data ?? '[]')).toEqual(conversation.messages);
  });

  it('does not write files when there are no messages to persist', async () => {
    const service = new ReasonixConversationHistoryService();
    const write = jest.fn<Promise<void>, [string, string]>(async () => undefined);

    service.setVaultAdapter(createAdapter({
      write,
    }));

    await service.saveMessages(createConversation());

    expect(write).not.toHaveBeenCalled();
  });

  it('deletes persisted session files and clears in-memory messages', async () => {
    const service = new ReasonixConversationHistoryService();
    const deletedPaths: string[] = [];
    const conversation = createConversation();
    conversation.messages = [
      {
        id: 'user-1',
        role: 'user',
        content: 'to be deleted',
        timestamp: 1,
      },
    ];

    service.setVaultAdapter(createAdapter({
      exists: async (path) => path === '.reasonix/sessions/session-1.messages.json',
      delete: async (path) => {
        deletedPaths.push(path);
      },
    }));

    await service.deleteConversationSession(conversation, null);

    expect(deletedPaths).toEqual(['.reasonix/sessions/session-1.messages.json']);
    expect(conversation.messages).toEqual([]);
  });
});
