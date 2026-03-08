# System Architecture & Project Structure

Tengra is built with a multi-process, polyglot architecture designed to maximize security, performance, and developer flexibility.

## 1. Process Model and Communication

Tengra utilizes Electron's multi-process architecture to isolate the user interface from the intensive system-level logic.

### Renderer Process (UI)
The frontend is a React application that runs in a context-isolated environment. It has no direct access to the operating system or the Node.js runtime.

**Key Components:**
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Monaco Editor** for code editing
- **xterm.js** for terminal emulation

### Main Process (Orchestration)
The Main process serves as the central hub. It manages the application's lifecycle, coordinates the service layer, and handles communication with external microservices.

**Key Responsibilities:**
- Service lifecycle management
- IPC handler registration
- Database initialization
- Proxy process management
- Native microservice coordination

### Inter-Process Communication (IPC)
Communication between the Renderer and Main process occurs over a secure IPC bridge.

| Category | Prefix | Examples |
|----------|--------|----------|
| Window/System | `window:`, `process:`, `health:` | Window controls, lifecycle events |
| Auth/Security | `auth:`, `key-rotation:`, `audit:` | OAuth, token management |
| AI/LLM | `chat:`, `ollama:`, `llama:`, `memory:` | Chat completions, model management |
| Project | `project:`, `git:`, `terminal:`, `ssh:` | Project operations, version control |
| Data | `db:`, `files:`, `backup:` | Database, filesystem, backup |
| UI | `settings:`, `theme:`, `clipboard:` | User preferences |

---

## 2. Project Structure

Tengra follows a strict organizational pattern to manage its multi-process architecture.

```text
tengra/
├── src/                # Primary source code
│   ├── main/           # Electron Main process
│   ├── renderer/       # Electron Renderer process
│   ├── shared/         # Universal types and constants
│   └── services/       # Native microservices (Rust and Go)
├── resources/          # Static assets and native binaries
├── scripts/            # Automation scripts
├── tests/              # Centralized test suites
├── vendor/             # External source trees
├── logs/               # Application logs (gitignored)
└── AI_RULES.md         # AI agent guidelines (Consolidated)
```

### Main Process Source (`src/main`)
- `ipc/`: IPC handlers (50+ handlers)
- `services/`: Domain-organized services (LLM, Data, Project, Security, System, Analysis, Proxy)
- `startup/`: Application initialization
- `logging/`: Logger infrastructure
- `repositories/`: Data repositories

### Renderer Process Source (`src/renderer`)
- `features/`: Feature modules (Chat, Settings, Projects, Terminal, Models, MCP, Memory)
- `components/`: Reusable UI components
- `context/`: React contexts
- `store/`: State management (Zustand/Store pattern)
- `hooks/`: Custom React hooks

---

## 3. Database Schema Reference

Tengra uses a standalone Rust-based database service (SQLite) and PGlite for internal state.

### Chat Domain
- **`chats`**: Stores chat conversations.
- **`messages`**: Stores individual messages with vector embeddings for semantic search.
- **`folders`**: Organizes chats into named folders.

### Project Domain
- **`projects`**: Stores development project configurations and workspace details.
- **`council_sessions`**: Stores AI council deliberation sessions.

### Knowledge & Memory Domain
- **`advanced_memories`**: Long-term memory system with validation and decay.
- **`code_symbols`**: Indexed code symbols for code intelligence.
- **`semantic_fragments`**: Vector search fragments.

### System Domain
- **`token_usage`**: Tracks LLM token consumption and cost.
- **`audit_logs`**: Security and operations audit trail.
- **`linked_accounts`**: OAuth/authentication linked account storage.

---

## 4. Native Microservices

Tengra delegates performance-critical tasks to specialized microservices.

### Go Proxy (CLIProxy-Embed)
- Request routing for external LLMs.
- Auth header injection.
- Streaming optimization.

### Rust Token Service
- Monitors token expiration.
- Executes automated refresh flows.

---

## 5. Architecture Patterns

- **Dependency Injection**: Factory-based service creation with lifecycle hooks.
- **Circuit Breaker**: Resilience pattern for external service calls.
- **Repository Pattern**: Data access abstraction.
- **Event-Driven Architecture**: Loose coupling via EventBus.
- **Lazy Loading**: On-demand service creation to reduce startup time.
