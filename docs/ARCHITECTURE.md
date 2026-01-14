# System & Model Architecture

This document provides a comprehensive overview of Orbit's system design, model integration, multi-LLM concurrency, and agent architecture.

---

## 1. System Overview

Orbit is built as a desktop application using **Electron**, leveraging modern web technologies for the frontend and a robust Node.js environment for the backend processes. The architecture follows a clear separation of concerns between the Renderer (UI) and the Main (System & Logic) processes, communicating via a secure Inter-Process Communication (IPC) bridge.

### High-Level Diagram

```mermaid
graph TD
    User[UserId] --> Renderer[Renderer Process (React)]
    Renderer -->|IPC Bridge| Main[Main Process (Node.js)]
    
    subgraph Main Process
        Main --> Services[Service Layer]
        Services --> Proxy[Proxy Service]
        Services --> LLM[LLM Service (Ollama/OpenAI)]
        Services --> DB[Database Service (SQLite)]
        Services --> FS[File System Service]
        Services --> SSH[SSH Service]
    end
    
    subgraph External
        Proxy --> CloudAPI[Cloud APIs (Antigravity/OpenAI)]
        LLM --> LocalModel[Local Ollama Instance]
        SSH --> RemoteServer[Remote Server]
    end
    
    subgraph Storage
        DB --> LocalDB[(Local SQLite DB)]
        FS --> LocalFiles[Local File System]
    end
```

### Component Breakdown

#### Renderer Process (Frontend)
The user interface is built with **React**, **TypeScript**, and **Tailwind CSS**. It is designed to be highly responsive and modular.

*   **ViewManager**: The central router that handles switching between Chat, Projects, Council, and Settings views.
*   **Context API**: State is managed globally using React Contexts (`AuthContext`, `ModelContext`, `ChatContext`, `ProjectContext`) to avoid prop drilling and ensure data consistency.
*   **Features**: Logic is grouped by feature folders (e.g., `features/chat`, `features/projects`) which contain their own hooks, components, and utilities.

#### Main Process (Backend)
The heavy lifting is done in the Electron Main process. It manages the application lifecycle, native integrations, and long-running tasks.

*   **Service Layer**: A collection of singleton services instantiated at startup using a Dependency Injection pattern.
    *   **DatabaseService**: Manages the local SQLite database for storing chats, messages, and settings.
    *   **OllamaService**: Handles communication with the local Ollama instance.
    *   **ProxyService**: Manages authentication and request routing to the Antigravity cloud proxy.
    *   **FileSystemService**: Provides safe abstractions for file operations.
    *   **SSHService**: Manages secure connections to remote servers.

#### IPC Bridge
Communication between the Renderer and Main processes is handled via a strictly typed `window.electron` API. This API exposes specific methods (e.g., `db.getAllChats()`, `llm.generate()`) rather than allowing arbitrary remote execution, ensuring security.

---

## 2. Model Integration & Authentication

Orbit supports multiple AI providers, both local and cloud-based.

### Provider Details

#### 1. ANTIGRAVITY (Google Cloud Code)
- **Authentication**: Google OAuth 2.0 (Device/Browser Flow).
- **Token Storage**: `%APPDATA%/orbit-ai/cliproxy-auth-work/antigravity-{email}.json`.
- **Model Fetching**: `https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels`.

#### 2. GITHUB COPILOT
- **Authentication**: GitHub OAuth Device Flow.
- **Token Hierarchy**: GitHub Token → Copilot Session Token (expires in 20 mins).
- **Model Fetching**: `{baseUrl}/models`.

#### 3. CODEX (OpenAI via ChatGPT.com)
- **Authentication**: Browser Cookie / Session Token.
- **Usage Fetching**: `https://chatgpt.com/backend-api/wham/usage`.

#### 4. OPENAI (Direct API)
- **Authentication**: API Key.
- **Endpoint**: `https://api.openai.com/v1/chat/completions`.

#### 5. ANTHROPIC, GEMINI, OLLAMA
- Standard API Key or local hosting integration.

---

## 3. Multi-LLM Concurrency System

Orbit enables multiple LLMs to work simultaneously and provides a responsive UI.

### Components

#### MultiLLMOrchestrator (`src/main/services/multi-llm-orchestrator.service.ts`)
Manages concurrent execution with:
- **Provider-specific limits**: Cloud (5-10), Local (1-2).
- **Priority-based queuing**: Optimal resource allocation.
- **Statistics tracking**: Real-time metrics (latency, errors).

#### Model Collaboration Service (`src/main/services/model-collaboration.service.ts`)
Enables strategies:
- **Consensus**: Common themes across responses.
- **Vote**: Majority-based selection.
- **Best-of-N**: Quality-scored selection.
- **Chain-of-Thought**: Sequential refinement.

---

## 4. Agent Architecture

Orbit uses a multi-agent system to handle complex tasks.

### Agent Types
- **Planner Agent**: Decomposes requests into actionable steps.
- **Executor Agent**: Executes steps using tools (file ops, commands).
- **Critic Agent**: Reviews and validates outputs.
- **Memory Agent**: Manages long-term context and historical facts.

### Internal Audit Mechanism
Agents follow a self-checking pattern:
1. Create a **TODO list** before execution.
2. Create a **checklist** with evaluative questions ("Is there a better way?").
3. Review after each action; don't mark as "done" unless it passes the audit.
4. Revise approach if the audit fails.

---

## 5. Data Flow

1.  **User Action**: User types a message.
2.  **State Update**: `ChatContext` updates UI immediately.
3.  **Persistence**: Message saved to local database via `db.addMessage()`.
4.  **Inference Request**: `useChatManager` triggers generation (Local or Cloud).
5.  **Streaming**: Response chunks streamed back via IPC.
6.  **Finalization**: Final message saved to the database.

---

## 6. Code Organization

To ensure maintainability and clarity, the codebase follows a modular structure.

### Project Structure

```
orbit/
├── src/
│   ├── main/           # Electron main process
│   │   ├── services/   # Backend services (organized by domain)
│   │   ├── ipc/        # IPC handlers
│   │   ├── startup/    # Application bootstrap
│   │   └── logging/    # Logger infrastructure
│   ├── renderer/       # React frontend
│   ├── shared/         # Shared types and utilities
│   ├── scripts/        # Build and utility scripts
│   └── tests/          # All test files
│       ├── unit/       # Unit tests
│       ├── integration/# Integration tests
│       └── e2e/        # End-to-end tests
├── docs/               # Documentation
├── logs/               # Log files
└── vendor/             # Third-party dependencies
```

### Main Process (`src/main/services`)

Services are grouped by domain:

*   **`llm/`**: AI model integrations (Ollama, Copilot, HuggingFace, ModelRegistry).
*   **`data/`**: Database, file persistence, backup, and migration services.
*   **`project/`**: Code analysis, git operations, docker, and project management.
*   **`security/`**: Authentication, encryption, token refresh (TokenService).
*   **`system/`**: Core system logic, configuration, command execution.
*   **`analysis/`**: Metrics, telemetry, and performance monitoring.
*   **`ui/`**: Theme management, notifications, and clipboard.
*   **`proxy/`**: Proxy management and quota services.

### Key Services

#### JobSchedulerService
Handles persistent, configurable recurring tasks:
- Model cache updates
- Token refresh cycles
- Saves state to restore schedules after restart

#### TokenService (formerly TokenRefreshService)
Unified token management for all providers:
- Google/Antigravity OAuth
- Codex/OpenAI OAuth
- Claude session cookies
- Copilot GitHub tokens

#### ModelRegistryService
Centralized model discovery:
- Fetches from Ollama Library and HuggingFace
- Caches model data locally
- Configurable update intervals

### Renderer Process (`src/renderer`)

*   **`features/`**: Contains domain-specific logic, hooks, and UI components (e.g., `chat`, `settings`, `projects`).
*   **`components/`**: Reusable, generic UI components (buttons, inputs, layout) that are agnostic to business logic.

### Configuration

User-configurable intervals in `settings.ai`:
- `modelUpdateInterval`: Model cache refresh (default: 1 hour)
- `tokenRefreshInterval`: OAuth token refresh (default: 5 min)
- `copilotRefreshInterval`: Copilot session refresh (default: 15 min)


