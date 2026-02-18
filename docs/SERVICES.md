# Service Architecture

Tandem is built on a modular, service-oriented architecture. By centralizing logic into domain-specific services, we maintain a codebase that is easy to test, debug, and extend.

## BaseService and Lifecycle

All services in Tandem inherit from a central `BaseService` class. This provides a consistent interface and set of utilities for every module in the system.

### Lifecycle Methods

| Method | Purpose | When Called |
|--------|---------|-------------|
| `initialize()` | Async setup (DB connections, child processes) | During app startup |
| `cleanup()` | Graceful shutdown (close handles, stop timers) | During app shutdown |
| `dispose()` | Resource cleanup | When service is destroyed |

### Structured Logging

`BaseService` provides built-in logging methods that automatically include the service name:

```typescript
import { BaseService } from '@main/services/base.service'
import { appLogger } from '@main/logging/logger'

export class MyService extends BaseService {
    constructor() {
        super('MyService');
    }

    async doWork(): Promise<void> {
        this.logInfo('Starting work...');        // [MyService] Starting work...
        this.logError('Failed', error as Error); // [MyService] Failed: <error>
        this.logWarn('Resource low', { remaining: 10 });
    }
}
```

## Service Domains

Services are organized into logical domains to minimize cross-dependencies and ensure each module has a clear responsibility.

### LLM Domain (`services/llm/`)

Handles all AI model interactions.

| Service | Purpose |
|---------|---------|
| **LLMService** | Multi-provider LLM integration with circuit breakers |
| **OllamaService** | Local Ollama model management and inference |
| **OllamaHealthService** | Ollama health monitoring |
| **LlamaService** | Local LLaMA model integration |
| **HuggingFaceService** | HuggingFace model hub integration |
| **CopilotService** | GitHub Copilot integration with OAuth |
| **ModelRegistryService** | Model registration and discovery |
| **ModelDownloaderService** | Model downloading from various sources |
| **ModelFallbackService** | Fallback chain for model availability |
| **EmbeddingService** | Text embedding generation for semantic search |
| **MemoryService** | Conversation memory management |
| **AdvancedMemoryService** | Vector-based semantic memory with embeddings |
| **BrainService** | AI reasoning and context management |
| **AgentService** | AI agent orchestration |
| **IdeaGeneratorService** | AI-powered idea generation |
| **ResponseCacheService** | LLM response caching |
| **PromptTemplatesService** | Prompt template management |
| **TokenEstimationService** | Token counting for context management |

### Data Domain (`services/data/`)

Manages all persistent storage.

| Service | Purpose |
|---------|---------|
| **DatabaseService** | PGlite database management with migrations |
| **DatabaseClientService** | Low-level database client |
| **FileSystemService** | Secure file operations with allowed roots |
| **FileManagementService** | High-level file management |
| **FileChangeTracker** | File change tracking for sync |
| **ChatEventService** | Chat event persistence |
| **ImagePersistenceService** | Image storage and retrieval |
| **BackupService** | Backup and restore functionality |
| **ExportService** | Data export functionality |

### Project Domain (`services/project/`)

Manages workspace and development tools.

| Service | Purpose |
|---------|---------|
| **ProjectService** | Project management and workspace handling |
| **ProjectAgentService** | AI agent for project tasks with checkpointing |
| **ProjectScaffoldService** | Project scaffolding and templating |
| **CodeIntelligenceService** | Code analysis with embeddings |
| **GitService** | Git operations |
| **SSHService** | SSH connection management |
| **DockerService** | Docker container management |
| **TerminalService** | Terminal emulation (local, SSH, Docker backends) |
| **TerminalProfileService** | Terminal profile management |
| **TerminalSmartService** | AI-enhanced terminal with suggestions |
| **MultiAgentOrchestratorService** | Multi-agent task orchestration |

### Agent Sub-domain (`services/project/agent/`)

| Service | Purpose |
|---------|---------|
| **AgentRegistryService** | Agent registration and discovery |
| **AgentPersistenceService** | Agent state persistence |
| **AgentCheckpointService** | Execution checkpoints for rollback |
| **AgentCollaborationService** | Inter-agent communication |
| **AgentTemplateService** | Agent templates and presets |
| **AgentPerformanceService** | Agent performance metrics |
| **AgentTaskExecutor** | Individual task execution engine |

### Security Domain (`services/security/`)

Handles authentication and encryption.

| Service | Purpose |
|---------|---------|
| **AuthService** | Multi-provider authentication (GitHub, Copilot) |
| **AuthAPIService** | Authentication API endpoints |
| **TokenService** | Token management and refresh |
| **SecurityService** | Cryptographic primitives and validation |
| **KeyRotationService** | API key rotation management |
| **RateLimitService** | Rate limiting for API calls |

### System Domain (`services/system/`)

System-level operations.

| Service | Purpose |
|---------|---------|
| **SettingsService** | Application settings with persistence |
| **ConfigService** | Configuration management |
| **EventBusService** | Pub/sub event system |
| **CommandService** | Shell command execution with validation |
| **SystemService** | System-level operations |
| **NetworkService** | Network diagnostics |
| **ProcessService** | Child process management |
| **ProcessManagerService** | Centralized process lifecycle |
| **JobSchedulerService** | Scheduled task execution |
| **HealthCheckService** | Application health monitoring |
| **UpdateService** | Application updates |

### Proxy Domain (`services/proxy/`)

API proxy management.

| Service | Purpose |
|---------|---------|
| **ProxyService** | Embedded proxy server for API routing |
| **ProxyProcessManager** | Proxy process lifecycle |
| **QuotaService** | API quota management with provider-specific handlers |

### Analysis Domain (`services/analysis/`)

Metrics and monitoring.

| Service | Purpose |
|---------|---------|
| **MonitoringService** | System monitoring |
| **PerformanceService** | Performance metrics collection |
| **TelemetryService** | Usage telemetry |
| **UsageTrackingService** | Feature usage tracking |
| **TimeTrackingService** | Time spent tracking |
| **AuditLogService** | Security audit logging |
| **MetricsService** | Application metrics |
| **SentryService** | Error reporting to Sentry |
| **ScannerService** | Code scanning |

### External Domain (`services/external/`)

External service integrations.

| Service | Purpose |
|---------|---------|
| **WebService** | Web scraping and search (Tavily) |
| **HttpService** | HTTP client wrapper |
| **ContentService** | Content fetching and processing |
| **UtilityService** | Miscellaneous utilities |
| **LogoService** | Logo generation |
| **MarketResearchService** | Market research integration |
| **FeatureFlagService** | Feature flag management |
| **CollaborationService** | Real-time collaboration |

### UI Domain (`services/ui/`)

UI-related backend services.

| Service | Purpose |
|---------|---------|
| **ThemeService** | Theme management (dark/light) |
| **ClipboardService** | Clipboard operations |
| **NotificationService** | Desktop notifications |
| **ScreenshotService** | Screenshot capture |

### MCP Domain (`services/mcp/`)

Model Context Protocol plugin system.

| Service | Purpose |
|---------|---------|
| **McpPluginService** | MCP plugin lifecycle management |
| **McpMarketplaceService** | MCP plugin marketplace |

## Dependency Injection

Tandem uses a centralized dependency injection pattern to manage service relationships.

### Container API

```typescript
// src/main/core/container.ts

// Register a service
container.register(
    'myService',
    (dep1, dep2) => new MyService(dep1 as Dep1, dep2 as Dep2),
    ['dependency1', 'dependency2']
);

// Resolve a service
const myService = container.resolve<MyService>('myService');

// Check if registered
container.has('myService');

// Get all registered service names
container.getRegisteredServices();
```

### Registration Process

Services are registered in `src/main/startup/services.ts`:

```typescript
// Core services first
container.register('settingsService', () => new SettingsService());
container.register('eventBusService', () => new EventBusService());

// Dependent services after dependencies
container.register(
    'authService',
    (settings, eventBus) => new AuthService(
        settings as SettingsService,
        eventBus as EventBusService
    ),
    ['settingsService', 'eventBusService']
);
```

### Lifecycle Management

```typescript
// Initialize all singletons
await container.initializeSingletons();

// Cleanup all services
await container.cleanupAll();
```

## Circuit Breaker Pattern

Used for resilience with external services:

```typescript
import { CircuitBreaker } from '@main/core/circuit-breaker';

const breaker = new CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 30000,
    halfOpenMaxCalls: 3
});

const result = await breaker.execute(async () => {
    return await externalService.call();
});
```

### States

| State | Behavior |
|-------|----------|
| **CLOSED** | Normal operation, requests pass through |
| **OPEN** | Requests blocked, waiting for reset timeout |
| **HALF_OPEN** | Limited requests allowed to test recovery |

## Repository Pattern

Data access abstraction for consistent database operations.

### Interface

```typescript
interface IRepository<T> {
    findAll(): Promise<T[]>;
    findById(id: string): Promise<T | null>;
    create(entity: Omit<T, 'id'>): Promise<T>;
    update(id: string, entity: Partial<T>): Promise<T | null>;
    delete(id: string): Promise<boolean>;
    count(): Promise<number>;
}
```

### Implementations

| Repository | Purpose |
|------------|---------|
| `ChatRepository` | Chat persistence |
| `ProjectRepository` | Project data |
| `KnowledgeRepository` | Knowledge base |
| `SystemRepository` | System data |
| `UacRepository` | User account data |

## Event-Driven Architecture

Services communicate through `EventBusService`:

```typescript
// Subscribe to events
eventBusService.subscribe('db:ready', () => {
    console.log('Database is ready');
});

// Emit events
eventBusService.emit('db:ready', { timestamp: Date.now() });

// Unsubscribe
const unsubscribe = eventBusService.subscribe('event', handler);
unsubscribe();
```

### Common Events

| Event | When Emitted |
|-------|--------------|
| `db:ready` | Database initialized |
| `db:error` | Database error |
| `settings:changed` | Settings updated |
| `auth:status-changed` | Auth state changed |

## Lazy Loading

Expensive services are loaded on-demand:

```typescript
import { createLazyServiceProxy } from '@main/core/lazy-services';

// Create lazy proxy
const lazyDockerService = createLazyServiceProxy<DockerService>(
    'dockerService',
    () => container.resolve<DockerService>('dockerService')
);

// Service only created when first method is called
await lazyDockerService.listContainers();
```

### Lazy Services

- `DockerService` - Docker operations
- `SSHService` - SSH connections
- `ScannerService` - Code scanning
- `PageSpeedService` - Performance analysis

## Testing Benefits

The DI pattern enables easy testing:

```typescript
// Production
const authService = new AuthService(realSettings, realEventBus);

// Testing
const mockSettings = createMockSettings();
const mockEventBus = createMockEventBus();
const authService = new AuthService(mockSettings, mockEventBus);

// Now test authService in isolation
```
