#!/usr/bin/env node
// Clean up all original Claudian files and directories no longer needed

const { execSync } = require('child_process');

const toDelete = [
  // CLAUDE.md files (architecture docs specific to original Claudian)
  'CLAUDE.md',
  'src/core/CLAUDE.md',
  'src/features/chat/CLAUDE.md',
  'src/style/CLAUDE.md',

  // Original AGENTS docs
  'AGENTS.md',

  // Claudian-unique files
  'bun.lock',

  // Test files that reference deleted providers (entire directories)
  'tests/unit/providers/claude',
  'tests/unit/providers/codex',
  'tests/integration/core/agent',
  'tests/integration/core/mcp',

  // Files that reference deleted sdk
  'tests/helpers/sdkMessages.ts',
  'tests/__mocks__/claude-agent-sdk.ts',
  'tests/__mocks__/codex-sdk.ts',
];

let deletedCount = 0;
for (const path of toDelete) {
  try {
    execSync(`git rm -r --quiet "${path}" 2>nul || git rm --quiet "${path}" 2>nul`, { cwd: 'claudian' });
    console.log(`✓ Removed: ${path}`);
    deletedCount++;
  } catch {
    console.log(`- Skipped (not tracked): ${path}`);
  }
}

console.log(`\nDone. ${deletedCount} files/directories removed.`);
