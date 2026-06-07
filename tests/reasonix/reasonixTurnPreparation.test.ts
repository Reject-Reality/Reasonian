import type { ChatTurnRequest } from '../../src/core/runtime/types';
import { appendReasonixObsidianContext } from '../../src/providers/reasonix/runtime/reasonixTurnPreparation';

function createRequest(overrides: Partial<ChatTurnRequest> = {}): ChatTurnRequest {
  return {
    text: 'User request',
    ...overrides,
  };
}

describe('appendReasonixObsidianContext', () => {
  it('appends note, editor, browser, canvas, and external context for normal turns', () => {
    const result = appendReasonixObsidianContext(
      'Base prompt',
      createRequest({
        currentNotePath: 'notes/spec.md',
        editorSelection: {
          notePath: 'notes/spec.md',
          mode: 'selection',
          selectedText: 'selected block',
          startLine: 4,
          lineCount: 2,
        },
        browserSelection: {
          source: 'browser-use',
          selectedText: 'browser snippet',
          title: 'Docs',
          url: 'https://example.com',
        },
        canvasSelection: {
          canvasPath: 'boards/plan.canvas',
          nodeIds: ['node-a', 'node-b'],
        },
        externalContextPaths: ['repo/src', 'repo/tests'],
      }),
      false,
    );

    expect(result).toContain('Base prompt');
    expect(result).toContain('<current_note>\nnotes/spec.md\n</current_note>');
    expect(result).toContain('<editor_selection path="notes/spec.md" lines="4-5">');
    expect(result).toContain('selected block');
    expect(result).toContain('<browser_selection source="browser-use" title="Docs" url="https://example.com">');
    expect(result).toContain('browser snippet');
    expect(result).toContain('<canvas_selection path="boards/plan.canvas">');
    expect(result).toContain('node-a, node-b');
    expect(result).toContain('<context_files>\nrepo/src, repo/tests\n</context_files>');
  });

  it('skips Obsidian context injection for compact turns', () => {
    const result = appendReasonixObsidianContext(
      'Compact prompt',
      createRequest({
        currentNotePath: 'notes/spec.md',
        externalContextPaths: ['repo/src'],
      }),
      true,
    );

    expect(result).toBe('Compact prompt');
    expect(result).not.toContain('<current_note>');
    expect(result).not.toContain('<context_files>');
  });
});
