# Tengra Architecture

```text
User
  |
  v
Renderer UI (React views, hooks, state)
  |
  v
Web Bridge (src/renderer/web-bridge.ts)
  |
  v
Preload Layer (main/preload + domain bridges)
  |
  v
IPC Channels (src/shared/constants/ipc-channels.ts)
  |
  v
Main Process (Electron host)
  |
  +--> System services
  |      settings, window, update, process, runtime
  |
  +--> LLM services
  |      ollama, llama, embedding, memory, brain
  |
  +--> Data services
  |      database, files, git, backups
  |
  +--> Security & auth
  |      accounts, sessions, keys
  |
  +--> Tools & automation
         terminal, ssh, mcp, agent, marketplace

Local storage and integrations
  - SQLite / app data
  - Workspace files
  - Runtime cache / temp
  - Ollama / local models
  - Hugging Face
  - GitHub / providers
  - Remote SSH targets
  - MCP servers
```

## How It Works

1. The user interacts with the renderer UI.
2. Renderer code calls the typed bridge in `src/renderer/web-bridge.ts`.
3. Preload modules expose a narrow API and forward calls through shared IPC channel constants.
4. The main process receives those calls and routes them into domain services.
5. Services read or write local data, coordinate workflows, and call external systems when needed.
6. Results and streaming events flow back to the renderer through IPC.

## Main Flow

- Renderer handles presentation, user input, and local view state.
- Preload is the security boundary between renderer and main.
- `ipc-channels.ts` is the source of truth for channel names.
- Main services own business logic and validation.
- Data services persist state in local storage and workspace files.
- LLM and tooling services talk to local models, remote providers, SSH targets, and MCP servers.

## Common Paths

- Chat and automation: renderer -> preload -> main services -> LLM / memory / data -> renderer.
- File and workspace actions: renderer -> preload -> main -> files / git / workspace services -> renderer.
- Voice and process events: main emits events back to the renderer through IPC listeners.
- Auth and provider flows: renderer requests login or account actions, main coordinates providers and stores credentials locally.
