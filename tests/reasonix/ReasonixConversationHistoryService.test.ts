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

  it('round-trips saved messages through the vault adapter and restores turn ids', async () => {
    const files = new Map<string, string>();
    const folders = new Set<string>();
    const service = new ReasonixConversationHistoryService();

    service.setVaultAdapter(createAdapter({
      exists: async (path) => files.has(path) || folders.has(path),
      mkdir: async (path) => {
        folders.add(path);
      },
      write: async (path, data) => {
        files.set(path, data);
      },
      read: async (path) => {
        const value = files.get(path);
        if (value === undefined) {
          throw new Error(`Missing file: ${path}`);
        }
        return value;
      },
    }));

    const sourceConversation = createConversation();
    sourceConversation.messages = [
      {
        id: 'user-1',
        role: 'user',
        content: 'hello round trip',
        timestamp: 1,
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'restored',
        timestamp: 2,
      },
    ];

    await service.saveMessages(sourceConversation);

    const restoredConversation = createConversation();
    await service.hydrateConversationHistory(restoredConversation, null);

    expect(restoredConversation.messages).toHaveLength(2);
    expect(restoredConversation.messages[0]?.content).toBe('hello round trip');
    expect(restoredConversation.messages[0]?.userMessageId).toBe('reasonix:user-turn:0');
    expect(restoredConversation.messages[1]?.assistantMessageId).toBe('reasonix:assistant-turn:0');
  });

  it('returns the session id fallback chain for fork source resolution', () => {
    const service = new ReasonixConversationHistoryService();
    const conversation = createConversation();

    expect(service.resolveSessionIdForConversation(conversation)).toBe('session-1');

    conversation.sessionId = null;
    expect(service.resolveSessionIdForConversation(conversation)).toBe('conv-1');
    expect(service.resolveSessionIdForConversation(null)).toBeNull();
  });

  it('builds fork provider state by preserving source provider metadata', () => {
    const service = new ReasonixConversationHistoryService();

    expect(service.isPendingForkConversation(createConversation())).toBe(false);
    expect(service.buildForkProviderState(
      'source-session',
      'reasonix:assistant-turn:3',
      { model: 'deepseek-v4-pro', branch: 'fork-a' },
    )).toEqual({
      model: 'deepseek-v4-pro',
      branch: 'fork-a',
      sourceSessionId: 'source-session',
      resumeAt: 'reasonix:assistant-turn:3',
    });
  });
});
