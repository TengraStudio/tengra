# Startup Activation Matrix

## Goal

Shrink cold start to the minimum work required to show the core Tengra shell, then move feature-heavy initialization behind explicit deferred or on-demand boundaries.

## Startup Phases

### Phase 0: Process Boot

Runs before service construction.

- load environment variables
- set Electron process flags
- pre-register custom protocols
- configure splash window eligibility

### Phase 1: Core Services Before Window

Runs inside `app.whenReady()` before the main window exists.

- validate environment variables
- register allowed file roots and protocols
- build the service container via `createServices()`
- run managed runtime scan and startup gate decisions
- start only hard dependencies that gate core data access
  - `databaseService.initialize()` when managed runtime is ready
  - `proxyService.startEmbeddedProxy()` when managed runtime is ready
- construct `ToolExecutor`
- create and register `ApiServerService` instance without initializing it yet
- register IPC handlers and lifecycle hooks

Recorded metrics:

- `coreServicesReadyTime`
- `ipcReadyTime`

### Phase 2: Window Creation / First Paint

Runs after the minimal core shell is ready.

- create main window
- wait for `ready-to-show`
- mark shell-ready timing
- wait for `did-finish-load`

Recorded metrics:

- `windowCreatedTime`
- `readyTime`
- `loadTime`

### Phase 3: Deferred Core Features

Runs after the shell is visible or after the deferred timeout fallback.

- initialize `localImageService`
- initialize `apiServerService`
- initialize `mcpPluginService`
- initialize all container-deferred services via `startDeferredServices()`
- start Ollama bootstrap flow
- initialize update service
- initialize sentry service

Recorded metrics:

- `deferredStartTime`
- `localImageReadyTime`
- `apiServerReadyTime`
- `deferredServicesReadyTime`

### Phase 4: On-Demand Features

Never block first paint. These initialize only when the user opens or triggers the feature surface.

- shared prompt table bootstrap
- backup/export workflows
- idea generation and market research surfaces
- terminal Docker interactions
- advanced memory / brain / orchestration surfaces already behind lazy or deferred paths

Deferred-but-not-core feature registration currently includes:

- SSH IPC registration and `SSHService` resolution

## Current Activation Inventory

### Critical Before Window

- `DataService`
- `SettingsService`
- `SecurityService`
- `EventBusService`
- `RuntimeManifestService`
- `RuntimeHealthService`
- `RuntimeBootstrapService`
- `ProcessManagerService`
- `DatabaseService`
- `ProxyService`
- `LLMService`
- `ModelRegistryService`
- IPC registration prerequisites

### Critical Before Interaction

- browser window creation
- typed IPC registration
- runtime gate status availability for renderer bootstrap

### Deferred After Shell

From `DEFERRED_SERVICE_NAMES` plus explicit post-shell startup tasks:

- `telemetryService`
- `usageTrackingService`
- `auditLogService`
- `performanceService`
- `monitoringService`
- `sentryService`
- `collaborationService`
- `exportService`
- `screenshotService`
- `advancedMemoryService`
- `embeddingService`
- `brainService`
- `codeIntelligenceService`
- `contextRetrievalService`
- `multiModelComparisonService`
- `modelCollaborationService`
- `inlineSuggestionService`
- `promptTemplatesService`
- `agentService`
- `agentRegistryService`
- `agentPersistenceService`
- `agentCheckpointService`
- `agentPerformanceService`
- `automationWorkflowService`
- `multiAgentOrchestratorService`
- `marketResearchService`
- `ideaGeneratorService`
- `workspaceScaffoldService`
- `backupService`
- `localImageService`
- `apiServerService`
- `mcpPluginService`
- `updateService`

## Optimization Rules

- No feature-local service should block `ready-to-show` unless it is required for the first visible shell.
- No startup path should eagerly resolve lazy feature services just to register future capabilities.
- Services that only need schema/table preparation must self-initialize on first use instead of forcing startup work.
- Startup timing must be recorded with explicit phase events, not inferred from logs.

## Recent Changes

- `localImageService.initialize()` moved from pre-window startup into deferred startup.
- `apiServerService.initialize()` moved from pre-window startup into deferred startup.
- SSH IPC registration moved out of the pre-window path and now resolves `SSHService` during deferred startup.
- `SharedPromptsService` now self-initializes on first use and no longer forces table setup during startup.
- `readyTime` now tracks the actual `ready-to-show` milestone instead of earlier service setup.
- packaged runtime startup budgets are now asserted by `src/tests/e2e/performance.spec.ts` and documented in `docs/architecture/PERFORMANCE_CONTRACT.md`

## Next Follow-Through

- move more feature-local IPC registration behind deferred registration groups
- reduce pre-window `buildServicesMap()` resolutions for services that are only needed by deferred IPC
- enforce a contributor checklist for putting new feature services into one of the four activation phases
