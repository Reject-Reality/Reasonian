import { SessionStorage } from '../../src/core/bootstrap/SessionStorage';
import { ProviderRegistry } from '../../src/core/providers/ProviderRegistry';
import type { Conversation, SessionMetadata } from '../../src/core/types';

type AdapterLike = {
  write(path: string, content: string): Promise<void>;
  read(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
  delete(path: string): Promise<void>;
  listFiles(path: string): Promise<string[]>;
};

function createConversation(): Conversation {
  return {
    id: 'conv-1',
    providerId: 'reasonix',
    title: 'Resume test',
    createdAt: 1,
    updatedAt: 2,
    sessionId: 'session-1',
    providerState: {
      conversationId: 'conv-1',
      sourceSessionId: 'source-session',
      resumeAt: 'reasonix:assistant-turn:1',
    },
    messages: [],
    currentNote: 'notes/spec.md',
    externalContextPaths: ['repo/src'],
    enabledMcpServers: ['filesystem'],
    resumeAtMessageId: 'reasonix:assistant-turn:1',
  };
}

function createAdapter(): { adapter: AdapterLike; files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    adapter: {
      write: async (path, content) => {
        files.set(path, content);
      },
      read: async (path) => {
        const value = files.get(path);
        if (value === undefined) {
          throw new Error(`Missing file: ${path}`);
        }
        return value;
      },
      exists: async (path) => files.has(path),
      delete: async (path) => {
        files.delete(path);
      },
      listFiles: async (path) => (
        [...files.keys()].filter((key) => key.startsWith(`${path}/`) && key.endsWith('.meta.json'))
      ),
    },
  };
}

describe('SessionStorage resume metadata', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists providerState and resumeAtMessageId for reload recovery', async () => {
    const { adapter, files } = createAdapter();
    const storage = new SessionStorage(adapter as never);
    const conversation = createConversation();

    jest.spyOn(ProviderRegistry, 'getConversationHistoryService').mockReturnValue({
      hydrateConversationHistory: async () => undefined,
      deleteConversationSession: async () => undefined,
      resolveSessionIdForConversation: () => conversation.sessionId,
      isPendingForkConversation: () => false,
      buildForkProviderState: (_sourceSessionId, _resumeAt, sourceProviderState) => sourceProviderState ?? {},
      buildPersistedProviderState: (conv) => conv.providerState,
    });

    const metadata = storage.toSessionMetadata(conversation);
    await storage.saveMetadata(metadata);

    const raw = files.get('.claudian/sessions/conv-1.meta.json');
    expect(raw).toBeDefined();

    const saved = JSON.parse(raw ?? '{}') as SessionMetadata;
    expect(saved.providerState).toEqual(conversation.providerState);
    expect(saved.resumeAtMessageId).toBe('reasonix:assistant-turn:1');
    expect(saved.currentNote).toBe('notes/spec.md');
    expect(saved.externalContextPaths).toEqual(['repo/src']);
  });

  it('loads persisted metadata with providerState and resume checkpoint intact', async () => {
    const { adapter } = createAdapter();
    const storage = new SessionStorage(adapter as never);
    const metadata: SessionMetadata = {
      id: 'conv-1',
      providerId: 'reasonix',
      title: 'Resume test',
      createdAt: 1,
      updatedAt: 2,
      sessionId: 'session-1',
      providerState: {
        conversationId: 'conv-1',
        sourceSessionId: 'source-session',
        resumeAt: 'reasonix:assistant-turn:1',
      },
      currentNote: 'notes/spec.md',
      externalContextPaths: ['repo/src'],
      enabledMcpServers: ['filesystem'],
      resumeAtMessageId: 'reasonix:assistant-turn:1',
    };

    await storage.saveMetadata(metadata);
    const loaded = await storage.loadMetadata('conv-1');

    expect(loaded).toEqual(metadata);
  });
});
