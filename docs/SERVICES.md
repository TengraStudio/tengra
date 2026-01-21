# Services Architecture

Orbit follows a modular, service-oriented architecture in the backend. All services inherit from a `BaseService`, enabling consistent initialization, cleanup, and logging.

## Service Domains

Services are organized into domains to ensure high cohesive and low coupling.

### 1. Security Domain (`security/`)
Manages the security of user data and authentication state.
- **`TokenService`**: Handles unified OAuth token refreshes and session monitoring.
- **`AuthService`**: Manages the multi-account database and token encryption.
- **`SecurityService`**: Provides AES-256-GCM and safeStorage encryption primitives.
- **`AuthAPIService`**: Provides an internal HTTP API for secure cross-process token synchronization.

### 2. LLM Domain (`llm/`)
Manages interactions with local and cloud AI models.
- **`OllamaService`**: Communicates with the local Ollama daemon.
- **`MultiLLMOrchestrator`**: Manages concurrent model requests and prioritization.
- **`ModelRegistryService`**: Centralized discovery and caching of remote/local models.
- **`ModelCollaborationService`**: Implements strategies like Consensus and Best-of-N.

### 3. Data Domain (`data/`)
Handles all persistent storage and data migration.
- **`DatabaseService`**: Wrapper for PGlite, managing the relational schema and migrations.
- **`DataService`**: Responsible for platform-specific file path resolution.
- **`BackupService`**: Implements chat and settings export/import.
- **`ChatEventService`**: Manages real-time persistence of chat streams.

### 4. System Domain (`system/`)
Core runtime and OS-level integrations.
- **`ProcessManagerService`**: Lifecycle management for Go/Rust microservices.
- **`JobSchedulerService`**: Persistent, cron-like scheduling for background tasks.
- **`CommandService`**: Secure execution of system commands with sanitization.

### 5. Project Domain (`project/`)
Logic for local workspace management.
- **`ProjectService`**: Handles workspace indexing and metadata.
- **`GitService`**: Integration with local Git repositories.
- **`DockerService`**: Management of project containers.
- **`SSHService`**: Manages remote server connections and file transfers.

## Key Service Patterns

### Dependency Injection
Orbit uses a custom DI container (`src/main/startup/services.ts`) to manage service instantiation and dependencies. This ensures that services can be easily mocked during testing.

### Lifecycle Management
Every service inherits `BaseService`, which provides:
- **`initialize()`**: Called during app startup. All async setup should happen here.
- **`cleanup()`**: Called during app shutdown. Used for clearing intervals or closing handles.

### Error Handling & Logging
Services use `this.logError`, `this.logInfo`, and `this.logWarn` to route logs through the structured `appLogger`. All asynchronous operations MUST be wrapped in try-catch blocks to prevent main process crashes.
