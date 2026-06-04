# Reasonian Obsidian Integration Roadmap

This plan is based on the current `claudian/` worktree. `DeepSeek-Reasonix/` is treated as the upstream/reference library, not project code.

## Current State

Implemented or now wired:

- Single built-in provider: `reasonix`.
- Obsidian plugin shell, sidebar view, tabs, history dropdown, settings tab, hotkeys, and inline edit command.
- Reasonix main chat runtime using `DeepSeekClient` + `CacheFirstLoop`.
- Vault file tools, shell tools, code query tools, todo/plan/choice tools, optional web tools, memory tools, and MCP bridge.
- Message persistence in `.reasonix/sessions/*.messages.json`.
- MCP configuration in `.reasonix/mcp.json`, with legacy `.claude/mcp.json` migration fallback.
- Main chat context injection for current note, editor selection/cursor, browser selection, canvas selection, and external context paths.
- Selected external context roots are refreshed per turn and pre-authorized for Reasonix read access without persisting an "always allow" decision.
- Lightweight Reasonix-backed auxiliary services for title generation, instruction refinement, and inline edit.
- Reasonix-specific vault slash commands and skills are discovered from `.reasonix/commands/**/*.md`, `.reasonix/skills/*.md`, and `.reasonix/skills/*/SKILL.md`.
- Static Reasonix runtime commands stay read-only and take priority over vault commands with the same name.
- Vault commands and skills are prompt-template expansions into the Reasonix main loop, including `$ARGUMENTS` support.
- Obsidian vault events refresh the Reasonix command/skill catalog when `.reasonix/commands` or `.reasonix/skills` files are created, modified, renamed, or deleted.
- Reasonix settings include vault command/skill management for creating, editing, deleting, and refreshing `.reasonix` prompt templates.
- Rewind and fork are enabled for Reasonix conversations using stable local turn IDs and persisted Obsidian message history to rebuild the `CacheFirstLoop`.
- Production builds copy Reasonix grammar WASM assets into `grammars/` and run a release asset verification gate.

Still incomplete:

- Reasonix command/skill settings UI is intentionally lightweight; it still needs in-Obsidian UX QA and polish.
- Vault skills currently run as prompt templates in the main loop; native Reasonix skill/subagent execution is not integrated yet.
- Agent/subagent mention provider is disabled; Reasonix subagent lifecycle is not integrated with the Obsidian UI.
- Rewind and fork still need clean-vault Obsidian round-trip QA across reloads, local slash commands, and tool-heavy turns.
- Image attachments are intentionally disabled; Reasonix is text-only for now, and the system prompt now tells the model not to claim visual analysis.
- The settings/i18n layer still contains legacy Claudian/Claude/Codex labels in non-English locales and dead settings groups.

## P0: Make Core Obsidian Use Fully Reliable

1. Verify runtime readiness inside Obsidian.
   - Show a clear setup state when the Reasonix API key is missing.
   - Surface base URL/model/reasoning effort in `/status`.
   - Add a first-run smoke path: open view, send "hello", cancel stream, resume history.

2. Complete context delivery.
   - Keep current note, editor selection, browser selection, canvas selection, and external context tags in `prepareTurn`.
   - Selected external context directories are pre-authorized for read access during the active turn.
   - Ensure `@file` mention resolution works for both vault files and selected external directories.
   - Add tests for compact commands not receiving stale context tags.

3. Harden persistence and restore.
   - Persist message content, tool calls, content blocks, usage, MCP enabled servers, current note, and external contexts.
   - Verify reload into an existing session restores enough Reasonix loop history to continue without duplicate messages.
   - Add corrupted `.reasonix/sessions/*.messages.json` recovery UX.

4. Finish permissions.
   - Map Reasonian permission modes to Reasonix gate decisions consistently: review, yolo, plan.
   - Make shell/path approvals show accurate file paths and allow-once/always semantics.
   - Persist "always allow external context root" decisions only when the user explicitly chooses that.

5. Verify release packaging.
   - Production build includes `main.js`, `styles.css`, `manifest.json`, and `grammars/*.wasm`.
   - `npm run build` runs `scripts/verify-release-assets.mjs` and fails if grammar assets are missing.
   - Test install into a clean Obsidian vault from copied release files.

## P1: Restore Claudian-Level Features on Reasonix

1. User commands and skills.
   - Implemented discovery/storage for `.reasonix/commands/**/*.md`, `.reasonix/skills/*.md`, and `.reasonix/skills/*/SKILL.md`.
   - Implemented dropdown entries, frontmatter metadata, static-command collision handling, and `$ARGUMENTS` template expansion.
   - Implemented vault file-change listeners so externally edited commands and skills refresh automatically.
   - Implemented a lightweight Reasonix settings UI for save/delete/edit management.
   - Polish the settings UI after Obsidian visual QA.
   - Keep static runtime commands (`/compact`, `/status`, `/memory`, etc.) read-only.
   - Decide whether vault skills should remain main-loop prompt templates or be upgraded to native Reasonix skill execution.

2. Reasonix agents/subagents.
   - Decide whether to use Reasonix `registerSubagentTool` or a project-local agent abstraction.
   - Implement `agentMentionProvider`, agent storage, and mention dropdown entries.
   - Add `ProviderSubagentLifecycleAdapter` if Reasonix emits spawn/wait/close tool events that should render as subagent cards.
   - Implement `loadSubagentToolCalls` and `loadSubagentFinalResult` if async subagent records are persisted by Reasonix.

3. Rewind and fork.
   - Implemented local Reasonix turn IDs for model-backed user/assistant turns.
   - Implemented rewind through `CacheFirstLoop.rewindToUserTurn()` when the loop is hot, and persisted-message truncation/rebuild when the loop is cold.
   - Implemented fork source resolution so forked conversations cold-start from duplicated messages instead of inheriting the source runtime window.
   - Add clean-vault Obsidian QA for rewind/fork after plugin reload and for tool-heavy turns.

4. Image support.
   - Deferred intentionally: current Reasonix chat messages are text-only.
   - Keep `supportsImageAttachments` disabled so the Obsidian image attachment UI stays hidden.
   - Preserve image embeds as vault references only; do not inject image metadata or claim visual analysis until Reasonix exposes a real image-capable API.

5. Auxiliary services with tools.
   - Current title generation, instruction refinement, and inline edit use direct `DeepSeekClient.chat`.
   - Upgrade inline edit to optionally read referenced files through safe read-only tools.
   - Add small fixtures for parsing `<instruction>`, `<replacement>`, and `<insertion>` responses.

## P2: Polish and Simplify the Product

1. Remove stale multi-provider UI.
   - Hide or delete settings groups that only apply to Claude/Codex, such as CLI path, Claude plugins, and Codex safe mode.
   - Keep provider registry abstraction only where it still reduces risk.

2. Finish branding cleanup.
   - Update visible strings in all locale files to Reasonian/Reasonix and `.reasonix`.
   - Keep `claudian-` CSS classes until a dedicated visual regression pass, then optionally rename with compatibility aliases.
   - Rename internal TypeScript symbols only if it improves maintainability and does not churn unrelated files.

3. Improve settings UX.
   - Move API key/base URL/model/reasoning/memory/web/MCP into one coherent Reasonix settings page.
   - Add "Test API key" and "Test model" buttons.
   - Show memory root and MCP config paths explicitly.

4. Add automated checks.
   - Unit tests for `prepareTurn` context injection.
   - Unit tests for auxiliary response parsing and cancellation.
   - Integration-style test for message save/hydrate using a fake vault adapter.
   - Build test that verifies grammar assets are copied.

## Acceptance Checklist

Reasonian should be considered complete for Obsidian integration only when:

- A clean Obsidian vault can install the built plugin and open the Reasonian view.
- A user can configure API key/base URL/model and send a normal chat.
- Current note, editor selection, browser selection, canvas selection, file mentions, and external context directories are visible to Reasonix in a predictable format.
- Reasonix can read/write/search vault files, run approved shell commands, use MCP tools, and show tool results in the chat UI.
- Conversations survive Obsidian restart and can continue without duplicated context.
- Inline edit, instruction refinement, and auto-title generation work without stub responses.
- Unsupported capabilities are either implemented or hidden with accurate UX.
- `npm run typecheck` and `npm run build` pass, and release artifacts include grammar WASM assets.
