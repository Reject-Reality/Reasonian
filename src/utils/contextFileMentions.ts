import type { TFile } from 'obsidian';

import {
  buildExternalContextLookup,
  findBestMentionLookupMatch,
  isMentionStart,
  normalizeForPlatformLookup,
  normalizeMentionPath,
  resolveExternalMentionAtIndex,
} from './contextMentionResolver';
import { buildExternalContextDisplayEntries } from './externalContext';
import type { ExternalContextFile } from './externalContextScanner';

export interface ResolvedContextFilesOptions {
  message: string;
  vaultFiles: TFile[];
  normalizeVaultPath: (rawPath: string | undefined | null) => string | null;
  externalContextPaths?: string[];
  getExternalContextFiles?: (contextRoot: string) => ExternalContextFile[];
}

export function buildVaultMentionLookup(
  vaultFiles: TFile[],
  normalizeVaultPath: (rawPath: string | undefined | null) => string | null,
): Map<string, string> {
  const pathLookup = new Map<string, string>();

  for (const file of vaultFiles) {
    const normalized = normalizeVaultPath(file.path);
    if (!normalized) continue;

    const lookupKey = normalizeForPlatformLookup(normalizeMentionPath(normalized));
    if (!pathLookup.has(lookupKey)) {
      pathLookup.set(lookupKey, normalized);
    }
  }

  return pathLookup;
}

export function resolveContextFilesFromMessage(
  options: ResolvedContextFilesOptions,
): string[] {
  const {
    message,
    vaultFiles,
    normalizeVaultPath,
    externalContextPaths = [],
    getExternalContextFiles,
  } = options;

  if (!message.includes('@')) {
    return [];
  }

  const vaultLookup = buildVaultMentionLookup(vaultFiles, normalizeVaultPath);
  const externalEntries = buildExternalContextDisplayEntries(externalContextPaths)
    .sort((a, b) => b.displayNameLower.length - a.displayNameLower.length);
  const externalLookupCache = new Map<string, Map<string, string>>();
  const resolved = new Set<string>();

  const getExternalLookup = (contextRoot: string): Map<string, string> => {
    const cached = externalLookupCache.get(contextRoot);
    if (cached) return cached;

    const lookup = buildExternalContextLookup(getExternalContextFiles?.(contextRoot) ?? []);
    externalLookupCache.set(contextRoot, lookup);
    return lookup;
  };

  for (let index = 0; index < message.length; index++) {
    if (!isMentionStart(message, index)) continue;

    const externalMatch = externalEntries.length > 0
      ? resolveExternalMentionAtIndex(message, index, externalEntries, getExternalLookup)
      : null;
    if (externalMatch) {
      resolved.add(externalMatch.resolvedPath);
      index = externalMatch.endIndex - 1;
      continue;
    }

    const vaultMatch = findBestMentionLookupMatch(
      message,
      index + 1,
      vaultLookup,
      normalizeMentionPath,
      normalizeForPlatformLookup,
    );
    if (vaultMatch) {
      resolved.add(vaultMatch.resolvedPath);
      index = vaultMatch.endIndex - 1;
    }
  }

  return [...resolved];
}
