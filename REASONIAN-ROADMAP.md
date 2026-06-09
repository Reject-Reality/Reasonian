# Reasonian Roadmap

## 1. Product Positioning

Reasonian is an Obsidian desktop plugin that hosts Reasonix inside the vault workflow.

It should follow the practical spirit of [Claudian](https://github.com/YishenTu/claudian):

- provide a stable AI workspace inside Obsidian
- make configuration simple
- use Obsidian-native context well
- avoid rebuilding capabilities that already belong to the upstream agent runtime

Reasonian is not a second implementation of Reasonix.

## 2. Core Boundary

Reasonian owns:

- plugin lifecycle
- view registration and commands
- settings UI
- vault and editor context collection
- local persistence needed for Obsidian UX
- rendering and capability gating
- installation and release packaging

Reasonix owns:

- runtime semantics
- tool orchestration
- memory behavior
- deeper skill and subagent execution logic
- advanced agent-side capability expansion

Rule of thumb:

If a feature is fundamentally "how Reasonix thinks or runs", the plugin should integrate it rather than reimplement it.

## 3. MVP Goal

The MVP is complete when a user can:

1. install Reasonian into a clean Obsidian vault
2. open the Reasonian view
3. configure Reasonix with the required settings
4. send a normal chat request
5. use Obsidian context such as current note, selection, and `@file`
6. restart Obsidian and continue using recent sessions

This is an integration milestone, not a Claudian feature-parity milestone.

## 4. MVP Scope

### 4.1 Must Have

1. Plugin shell
   - register `reasonian-view`
   - provide ribbon and command entry
   - load and unload reliably

2. Single-provider model
   - Reasonix is the only supported provider
   - user-facing multi-provider complexity should be removed or hidden

3. Reasonix settings
   - API key
   - base URL
   - model
   - reasoning effort
   - minimal environment configuration where still needed

4. Basic chat flow
   - open sidebar chat
   - send message
   - render streaming output
   - cancel safely

5. Obsidian context integration
   - current note
   - editor selection or cursor context
   - vault `@file` mentions
   - external context directories where already supported

6. Persistence and recovery
   - save session metadata
   - save message history
   - restore recent sessions after restart
   - show recovery notice for corrupted data

7. Lightweight Obsidian-side helpers
   - inline edit
   - instruction refinement
   - title generation

8. Release readiness
   - `npm run typecheck` passes
   - `npm run build` passes
   - release assets include `main.js`, `styles.css`, `manifest.json`, and `grammars/`
   - clean-vault install works

### 4.2 Should Have

1. Minimal `/status`
   - active model
   - base URL summary
   - reasoning setting

2. Basic MCP visibility
   - settings entry remains usable
   - tool results render in a readable way

3. Clear capability gating
   - unsupported image entry points stay hidden
   - advanced agent affordances do not mislead users

### 4.3 Not in MVP

1. Plugin-managed native skill execution
2. Full subagent lifecycle UI parity
3. Image attachment and image understanding workflows
4. Deep local runtime mirroring Reasonix internals
5. Full Claudian parity before first release

## 5. Module Disposition

### 5.1 Keep and Continue

- plugin lifecycle and workspace view
- Reasonix provider wiring
- settings required for normal usage
- note and editor context collection
- `@file` resolution
- session persistence and recovery
- inline edit, title generation, instruction refinement
- build and install packaging

### 5.2 Keep but Simplify

- vault prompt templates
- MCP settings and status exposure
- `/status`
- rewind and fork UX
- tool cards and execution summaries
- background task rendering

These should remain useful, but lightweight. We do not need to turn the plugin into a full agent operations console.

### 5.3 Freeze or Deprioritize

- native subagent mention provider work
- plugin-owned skill runtime semantics
- broad architecture work done only to preserve legacy multi-provider patterns
- image pipeline work before real upstream support exists
- deeper agent lifecycle UI that does not improve the Obsidian host experience

## 6. Execution Priorities

### P0. Integration Reliability

Reasonian is usable as an Obsidian host for Reasonix.

Includes:

- clean-vault install succeeds
- view opens without crash
- missing config produces clear guidance
- normal chat path works
- context injection is predictable
- session persistence and recovery are reliable
- unsupported capabilities are hidden or clearly labeled

### P1. UX Simplification

Reasonian feels focused and does not pretend to own more runtime behavior than it actually does.

Includes:

- Reasonix-first wording in settings and UI
- reduction of misleading subagent and skill terminology
- simpler command template UX
- readable tool and status presentation

### P2. Post-MVP Enhancements

Only after P0 and P1 are stable:

- improved MCP transparency
- stronger rewind and fork reload handling
- richer diagnostics
- selective advanced task visualization if it improves real usage

## 7. Milestones

### Milestone A: Product Boundary Reset

Goal:

- align roadmap, module disposition, and user-visible wording with the integration-first strategy

Exit criteria:

- roadmap rewritten
- module disposition documented
- major misleading settings text reduced

### Milestone B: MVP Reliability

Goal:

- ensure install, configure, open, chat, persist, and restore all work reliably

Exit criteria:

- typecheck and build pass
- clean-vault install verified
- normal chat and restart recovery verified

### Milestone C: UX Simplification Pass

Goal:

- reduce user confusion from legacy multi-provider, skill, and subagent language

Exit criteria:

- unsupported features hidden or relabeled
- advanced placeholders clearly marked as non-MVP
- common settings and chat flows read as Reasonix integration, not local runtime ownership

### Milestone D: Release Preparation

Goal:

- produce a shippable internal or public build

Exit criteria:

- release package complete
- README and known limitations updated
- install steps reproducible

## 8. Acceptance Checklist

Reasonian should only be considered MVP-ready when all of the following are true:

- it installs into a clean Obsidian vault
- the Reasonian view opens successfully
- the user can configure Reasonix from settings
- the user can send and cancel a normal chat request
- current note and `@file` context work in a predictable format
- recent sessions survive restart without obvious duplication or corruption
- inline edit, title generation, and instruction refinement work as real features
- unsupported capabilities are hidden or clearly marked
- `npm run typecheck` and `npm run build` both pass

## 9. Development Rule

Before adding or expanding a feature, ask:

1. Is this improving the Obsidian host experience?
2. Or are we rebuilding Reasonix inside the plugin?

If it is the second one, default to not building it.
