import type { ChatTurnRequest } from '../../../core/runtime/types';
import { appendBrowserContext } from '../../../utils/browser';
import { appendCanvasContext } from '../../../utils/canvas';
import {
  appendContextFiles,
  appendCurrentNote,
} from '../../../utils/context';
import { appendEditorContext } from '../../../utils/editor';

export function appendReasonixObsidianContext(
  content: string,
  request: ChatTurnRequest,
  isCompact: boolean,
): string {
  if (isCompact) {
    return content;
  }

  let next = content;
  if (request.currentNotePath) {
    next = appendCurrentNote(next, request.currentNotePath);
  }
  if (request.editorSelection) {
    next = appendEditorContext(next, request.editorSelection);
  }
  if (request.browserSelection) {
    next = appendBrowserContext(next, request.browserSelection);
  }
  if (request.canvasSelection) {
    next = appendCanvasContext(next, request.canvasSelection);
  }
  const contextFiles = mergeContextFiles(
    request.contextFiles,
    request.externalContextPaths,
  );
  if (contextFiles.length > 0) {
    next = appendContextFiles(next, contextFiles);
  }

  return next;
}

function mergeContextFiles(
  contextFiles?: string[],
  externalContextPaths?: string[],
): string[] {
  const merged = new Set<string>();

  for (const file of contextFiles ?? []) {
    const trimmed = file.trim();
    if (trimmed) merged.add(trimmed);
  }

  for (const path of externalContextPaths ?? []) {
    const trimmed = path.trim();
    if (trimmed) merged.add(trimmed);
  }

  return [...merged];
}
