# Reasonian Module Disposition

This document maps the current `claudian/` codebase onto the integration-first roadmap in `REASONIAN-ROADMAP.md`.

The purpose is to decide, module by module, what should be:

- kept and continued
- kept but simplified
- frozen or deprioritized
- eventually removed if it no longer serves the Reasonian product boundary

Reasonian is treated as an Obsidian host shell for Reasonix, not a second implementation of Reasonix.

## Working Rule

For each module, we only keep three kinds of code:

- code required to install, open, configure, and use Reasonix inside Obsidian
- code required to make Obsidian-native context and persistence reliable
- code required to present Reasonix output clearly without misleading the user

If a module mainly exists to reproduce Reasonix-native runtime behavior inside the plugin, it should be frozen, simplified, or hidden from the MVP surface.

## Disposition Labels

- `Keep and continue`: keep as an MVP-bearing module and continue reliability work
- `Keep but simplify`: retain the module, but narrow UX and reduce platform-like ambitions
- `Freeze / deprioritize`: keep existing behavior only as needed for compatibility, but stop active expansion
- `Reduce exposure`: do not necessarily delete code, but remove misleading UI, wording, and discoverability

## Immediate Actions by Priority

### Priority A: Must align before release

1. Settings surfaces must read as a single-provider Reasonix product.
2. Unsupported image and advanced-agent affordances must stay hidden or clearly labeled.
3. Session persistence, recovery, and clean-vault install must remain stable.
4. User-visible chat rendering must not imply that Reasonian is a full subagent platform.

### Priority B: Simplify after core stability

1. Vault prompt templates should remain lightweight host-side helpers.
2. MCP configuration should stay understandable without becoming a full orchestration UI.
3. `/status`, rewind, and fork should remain usable, but not over-engineered.

### Priority C: Do not actively expand in MVP

1. Native subagent mention workflows
2. Plugin-owned skill execution semantics
3. Image workflow plumbing
4. Large internal renames that do not improve user understanding or maintainability enough

## 1. Plugin Shell and Bootstrap

### Scope

- `src/main.ts`
- `src/app/storage/*`
- `src/core/bootstrap/*`
- view registration, commands, unload and restore flow

### Disposition

Keep and continue.

### Why

This is the core Obsidian host layer. It directly supports the roadmap's MVP boundary:

- open the Reasonian view
- restore state
- persist sessions
- expose commands and ribbon entrypoints

### Refactor Direction

- keep behavior stable
- prefer renaming visible user-facing labels over broad internal file renames
- reduce provider-neutral wording where the product is now single-provider

### Concrete MVP Actions

- keep plugin startup, view registration, ribbon, commands, and restore flow unchanged unless fixing bugs
- treat this layer as release-critical and verify it whenever packaging or startup code changes
- avoid refactors here that are only aesthetic or architectural

## 2. Reasonix Settings and Provider Integration

### Scope

- `src/providers/reasonix/settings.ts`
- `src/providers/reasonix/registration.ts`
- `src/providers/reasonix/ui/*`
- `src/providers/reasonix/env/*`

### Disposition

Keep and continue, but simplify.

### Why

This is the primary integration layer between Obsidian and Reasonix.

### Refactor Direction

- keep API key, base URL, model, reasoning, memory, MCP, and environment support
- keep test API key and test model affordances
- remove or hide any settings that imply Claude/Codex parity or non-existent multi-provider value
- present settings as one coherent Reasonix experience

### Concrete MVP Actions

- continue removing Claudian, Claude, and Codex wording from visible settings copy
- keep advanced placeholders only if they are clearly marked as non-MVP or reserved
- prefer hiding unsupported toggles over showing dormant capability

## 3. Chat View, Tabs, Input, and Rendering

### Scope

- `src/features/chat/*`
- `src/features/inline-edit/*`
- `src/providers/reasonix/auxiliary/*`

### Disposition

Keep and continue, but reduce complexity where the UI mirrors old provider assumptions.

### Why

This is the user-facing Obsidian experience and is central to the product.

### Refactor Direction

- keep chat, tabs, message rendering, inline edit, title generation, and instruction refinement
- keep tool result rendering lightweight and useful
- preserve working rewind and fork entrypoints
- avoid new UI work that assumes deep native subagent integration unless Reasonix truly requires it

### Concrete MVP Actions

- keep the current chat shell and streaming path stable
- simplify user-visible wording around subagents into neutral Reasonix task or background task language
- do not remove working runtime paths unless they clearly mislead users or block shipping

## 4. Context Collection and File Mentions

### Scope

- `src/utils/contextFileMentions.ts`
- `src/providers/reasonix/runtime/reasonixTurnPreparation.ts`
- `src/features/chat/ui/FileContext.ts`
- `src/features/chat/controllers/InputController.ts`
- `src/features/inline-edit/ui/InlineEditModal.ts`

### Disposition

Keep and continue.

### Why

This is a key Obsidian-native differentiator and fits the integration boundary exactly.

### Refactor Direction

- keep current note, selection, cursor, and `@file` behavior
- keep external context handling
- continue removing duplication and stale context injection

### Concrete MVP Actions

- treat context correctness as a release blocker
- avoid expanding context formats unless it fixes a real Obsidian integration gap
- keep changes here test-oriented and reliability-oriented

## 5. Persistence and Recovery

### Scope

- `src/core/bootstrap/SessionStorage.ts`
- `src/providers/reasonix/history/*`
- recovery notices and restore paths in `src/main.ts`

### Disposition

Keep and continue.

### Why

Stable persistence is required for MVP and P0 acceptance.

### Refactor Direction

- keep metadata save and restore
- keep saved messages
- keep corrupted session recovery behavior
- continue validating restart behavior in Obsidian rather than adding abstract persistence complexity

### Concrete MVP Actions

- preserve existing corrupted-session recovery work
- continue favoring pragmatic restore validation over storage abstraction churn
- any regression here should be treated as P0

## 6. Runtime Integration

### Scope

- `src/providers/reasonix/runtime/ReasonixChatRuntime.ts`
- `src/providers/reasonix/runtime/reasonixApprovalPolicy.ts`
- `src/providers/reasonix/runtime/reasonixResumeCheckpoint.ts`
- `src/providers/reasonix/runtime/ReasonixTaskResultInterpreter.ts`

### Disposition

Keep, but stop expanding the runtime beyond integration needs.

### Why

A runtime adapter is necessary to talk to Reasonix inside Obsidian, but this area has the highest risk of drifting into a local reimplementation of Reasonix semantics.

### Refactor Direction

- preserve the parts needed for session execution, approvals, restore, and rendering
- avoid inventing plugin-owned equivalents of Reasonix-native capability models
- treat the runtime as an adapter layer, not the product center

### Concrete MVP Actions

- stop adding new host-side abstractions unless they are directly required by Obsidian integration
- prefer thin mapping layers over new plugin-owned execution semantics
- keep approval, resume, and turn-preparation work focused on reliability

## 7. Slash Commands, Vault Templates, and MCP Management

### Scope

- `src/providers/reasonix/app/ReasonixCommandCatalog.ts`
- `src/providers/reasonix/ui/ReasonixCommandSettingsManager.ts`
- `src/features/settings/ui/McpSettingsManager.ts`
- `src/providers/reasonix/app/ReasonixMcpStorage.ts`

### Disposition

Keep, but simplify.

### Why

These features are useful host-side conveniences, but they are not the core of the MVP.

### Refactor Direction

- keep prompt-template style vault commands and skills
- keep MCP visibility and configuration
- do not expand this into a plugin-owned execution platform
- optimize for clarity and low-maintenance UX

### Concrete MVP Actions

- present vault commands and skills as prompt templates, not native skill execution
- keep MCP management functional, but avoid adding orchestration-heavy UI concepts
- continue removing settings fields that imply fork or agent semantics the plugin does not honor

## 8. Subagent and Deep Agent Lifecycle UI

### Scope

- `src/features/chat/services/SubagentManager.ts`
- `src/features/chat/rendering/SubagentRenderer.ts`
- `src/features/chat/controllers/StreamController.ts` subagent paths
- `src/providers/reasonix/app/ReasonixWorkspaceServices.ts` agent mention provider
- subagent-related i18n keys and settings concepts

### Disposition

Freeze and deprioritize.

### Why

This is the clearest example of work that can easily turn into reimplementing Reasonix behavior in the plugin.

### Refactor Direction

- do not invest in new native subagent UX for MVP
- keep existing code only as long as it does not block shipping
- hide or avoid surfacing user-facing controls that suggest this is complete
- revisit only after the integration MVP is stable and Reasonix-side requirements are clear

### Concrete MVP Actions

- keep existing implementation for compatibility where already wired
- continue relabeling visible UI from "subagent platform" language to lighter task-oriented wording
- do not start structural expansion in this area during MVP

## 9. Image and Media Affordances

### Scope

- `src/features/chat/ui/ImageContext.ts`
- media-folder settings
- image-related copy in settings and i18n

### Disposition

De-emphasize now, potentially remove later.

### Why

Image workflows are explicitly outside MVP and currently unsupported by Reasonix integration.

### Refactor Direction

- keep image attachment UI disabled
- remove or hide user-facing settings that imply image support
- avoid adding new image-specific behavior

### Concrete MVP Actions

- leave image capability disabled
- remove residual image-facing wording from settings and help text when encountered
- do not spend runtime effort here before upstream support exists

## 10. Claudian / Claude / Codex Legacy Surface

### Scope

- general settings copy
- non-English i18n strings
- old safe-mode, plugin, CLI-path, Chrome, and multi-provider language
- CSS comments or low-value internal naming

### Disposition

Actively reduce user-facing exposure.

### Why

This is the biggest source of user confusion and makes the product look more complex than it should be.

### Refactor Direction

- prioritize visible UX cleanup first
- do not spend time on broad internal symbol churn unless it improves maintainability
- clean localized strings incrementally, starting with visible settings surfaces

### Concrete MVP Actions

- treat visible English settings and chat copy as first priority
- then clean high-frequency localized strings that users are likely to see during MVP flows
- defer deep internal renames unless they unblock future maintenance

## Immediate Refactor Priorities

1. Simplify the settings experience so it reflects a single-provider Reasonix product.
2. Remove or hide image-oriented settings that conflict with the stated MVP.
3. Reduce visible language that implies Claude/Codex/plugin parity or deep subagent completion.
4. Keep runtime and persistence work focused on reliability, not feature expansion.

## Current Execution Status

### Completed in current reset

- roadmap rewritten around integration-first scope
- module disposition document established
- settings copy simplified toward Reasonix-first positioning
- image-related visible settings reduced or reframed as compatibility-only
- vault template UI reframed away from native agent and fork semantics
- chat task rendering wording shifted away from subagent-platform language
- high-frequency localized settings copy cleaned across supported locale files

### Follow-up candidates

- continue cleaning low-frequency comments or internal identifiers only when they become maintenance pain
- review advanced placeholders again after real Reasonix-side agent requirements are known
- keep validating that future simplification does not break build or release output

### Not part of current MVP refactor

- full internal removal of subagent-related runtime paths
- deep architecture replacement of the runtime adapter
- image support implementation
- native Reasonix skill platform implementation in the plugin

## Rule for Future Changes

Any new work should answer this question:

Does this improve the Obsidian host experience for Reasonix, or does it recreate Reasonix inside the plugin?

If it is the second one, it should usually be deferred or rejected.
