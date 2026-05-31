# Reasonian

**Reasonian** embeds [Reasonix](https://github.com/esengine/DeepSeek-Reasonix) — the native DeepSeek coding agent — into your Obsidian sidebar. It provides file read/write, search, shell commands, MCP tools, and multi-step workflows directly inside your vault.

> Based on [Claudian](https://github.com/YishenTu/claudian) (MIT License), with the Claude backend replaced by Reasonix.

![Preview](./效果图.png)

---

## Features

- 💬 **Sidebar Chat** — Multi-tab, streaming output, thinking block display
- 🧠 **DeepSeek V4** — Flash / Pro models with reasoning effort control
- 🔧 **Tool Set** — File read/write, shell commands, web search, MCP servers
- 📝 **Inline Editing** — Select any text in a note, let the agent edit it
- 🎯 **Plan Mode** — Plan first, then execute — safe and controlled
- 🔄 **Session Persistence** — Messages saved to vault, survive restarts
- 🎨 **Slash Commands** — `/compact`, `/new`, `/model`, `/clear` and more
- 🌍 **i18n** — 10 languages supported
- 🧩 **Custom System Prompt** — Edit agent instructions in settings
- 💾 **Long-Term Memory** — REASONIX.md and user memory for cross-session knowledge

## Installation

> Not yet published to the Obsidian community plugin marketplace. Install manually.

1. Download the latest `main.js`, `styles.css`, `manifest.json` from [Releases](https://github.com/Reject-Reality/Reasonian/releases)
2. Create a folder `.obsidian/plugins/reasonian/` in your vault
3. Copy the three files into that folder
4. Restart Obsidian
5. Go to Settings → Community plugins → Turn off Safe Mode → Enable **Reasonian**

---

## Configuration

1. Open Obsidian Settings → **Reasonian**
2. Enter your **API Key** (get one from [DeepSeek Platform](https://platform.deepseek.com/api_keys))
3. Optional settings:
   - **Model**: `deepseek-v4-flash` (fast) / `deepseek-v4-pro` (deep thinking)
   - **Reasoning Effort**: low / medium / high
   - **Custom System Prompt**: additional instructions appended to every turn
   - **Long-Term Memory**: auto-inject `REASONIX.md` and `~/.reasonix/memory/`
   - **Default Mode**: Review (ask per action) / YOLO (auto-approve) / Plan (plan-then-execute)

---

## Architecture

| Layer | Purpose | Details |
|---|---|---|
| **app** | Shared defaults & plugin storage | `defaultSettings`, `ClaudianSettingsStorage`, `SharedStorageService` |
| **core** | Provider-agnostic contracts | Runtime, registry, tools, types |
| **providers/reasonix** | Reasonix runtime adaptor | `ChatRuntime` impl, session service, tool registration, UI config |
| **features/chat** | Main sidebar chat UI | `ClaudianView`, controllers, renderers, state management |
| **features/inline-edit** | Inline edit modal | `InlineEditModal` |
| **features/settings** | Settings page | General + API config + system prompt |
| **shared** | Reusable UI components | Dropdowns, modals, mention UI, icons |
| **i18n** | Internationalization | 10 languages |
| **utils** | Cross-cutting utilities | Editor, path, markdown, diff, context, images |
| **style** | Modular CSS | Components, toolbar, features, settings, modals |

---

## Storage Layout

| Path | Contents |
|---|---|
| `.reasonix/sessions/{id}.messages.json` | Chat message persistence |
| `.reasonix/settings.json` | Plugin settings |
| `.reasonix/mcp.json` | MCP server configuration |
| `.reasonix/commands/**/*.md` | User slash commands |
| `.reasonix/skills/*/SKILL.md` | User skills |
| `~/.reasonix/memory/` | User memory (global + per-project) |
| `REASONIX.md` (vault root) | Project memory |

---

## Development

```bash
git clone https://github.com/Reject-Reality/Reasonian.git
cd reasonian

# Build Reasonix dependency first
cd ../DeepSeek-Reasonix
npm install --ignore-scripts
npx tsup src/index.ts --format esm --dts --clean --sourcemap --target node22 --outDir dist
cd ../reasonian

npm run dev         # Watch + auto-build
npm run build       # Production build
npm run typecheck   # TypeScript type checking
```

---

## Credits

- [Claudian](https://github.com/YishenTu/claudian) — Based on this excellent Obsidian plugin architecture
- [Reasonix](https://github.com/esengine/DeepSeek-Reasonix) — DeepSeek-native coding agent engine
- [DeepSeek](https://deepseek.com) — High-quality LLM API

## License

MIT
