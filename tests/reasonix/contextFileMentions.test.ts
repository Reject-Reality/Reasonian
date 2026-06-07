import type { TFile } from 'obsidian';

import { resolveContextFilesFromMessage } from '../../src/utils/contextFileMentions';

function createVaultFile(path: string): TFile {
  return { path } as TFile;
}

describe('resolveContextFilesFromMessage', () => {
  it('resolves vault and external @file mentions with one shared parser', () => {
    const result = resolveContextFilesFromMessage({
      message: 'Please compare @notes/spec.md with @repo/src/main.ts and ignore @missing.md.',
      vaultFiles: [
        createVaultFile('notes/spec.md'),
        createVaultFile('notes/other.md'),
      ],
      normalizeVaultPath: (rawPath) => rawPath?.replace(/\\/g, '/') ?? null,
      externalContextPaths: ['C:/work/repo'],
      getExternalContextFiles: () => [
        {
          path: 'C:/work/repo/src/main.ts',
          name: 'main.ts',
          relativePath: 'src/main.ts',
          contextRoot: 'C:/work/repo',
          mtime: 0,
        },
      ],
    });

    expect(result).toEqual([
      'notes/spec.md',
      'C:/work/repo/src/main.ts',
    ]);
  });

  it('deduplicates repeated mentions and keeps punctuation handling', () => {
    const result = resolveContextFilesFromMessage({
      message: 'Review @notes/spec.md, then re-open @notes/spec.md.',
      vaultFiles: [createVaultFile('notes/spec.md')],
      normalizeVaultPath: (rawPath) => rawPath?.replace(/\\/g, '/') ?? null,
    });

    expect(result).toEqual(['notes/spec.md']);
  });
});
