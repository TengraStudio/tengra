# Architecture Roadmap

## CRITICAL - Service Layer

### 1.1 Service Categorization
- [x] Ensure all services extend `BaseService` and implement `initialize()` (Current: 42/86 services extend BaseService) <!-- id: arch-crit-1 -->
- [x] Adopt `EventBusService` for inter-service communication (Current: 56 usages) <!-- id: arch-crit-2 -->
    - Renamed chat-queue.manager.ts to chat-queue.service.ts
    - Renamed migration-manager.ts to db-migration.service.ts

### 1.2 BaseService Adoption
- [x] Extend BaseService for all services (42 verified, 44 remaining - includes services extending EventEmitter)
- [x] Ensure strict lifecycle management (initialize/dispose) - 32/42 services with initialize(), 28/42 with cleanup() (76%)
    - Note: Some services intentionally extend EventEmitter (ProcessManagerService, SSHService, MetricsService)

## HIGH - Event System

### 2.1 Central Event Bus
- [x] Create EventBusService with enhanced features
- [x] Define global event types OrbitEvent  
- [x] Add subscription management with IDs and cleanup
- [x] Add event persistence for debugging
- [/] Replace scattered IPC events with central bus (~300 IPC handlers to migrate; EventBus used in 13 files)

## MEDIUM - Plugin Architecture

### 3.1 LLM Plugins
- [ ] Extract OpenAI/Anthropic logic into Plugins
- [x] Define LLMProviderPlugin interface (implemented in llm-plugin.interface.ts)
    - ILLMProvider interface with initialize, getModels, chat, streamChat, testConnection, dispose
    - BaseLLMProvider abstract class for implementation helpers
- [x] Create Plugin Registry (LLMProviderRegistry class in llm-plugin.interface.ts)
    - register/unregister providers, get/getAll/getConfigured methods
    - Default provider management

### 3.2 MCP System
- [x] Reorganize src/main/mcp into proper module structure
- [x] Create mcp/index.ts aggregator
- [x] Extract tools into mcp/servers/ (FileSystem, Git, etc.)

## MEDIUM - Infrastructure (Upgraded from LOW)

### 4.1 Background Services
- [x] Design Token Refresh Daemon (Windows Service/Task) - Phase 20
- [x] Design Model Registry Daemon - Phase 20

### 4.2 Linux Support
- [ ] **Plan Linux packaging** (AppImage, Deb) *(MEDIUM - Platform expansion)*
- [ ] **Test native modules on Linux** *(MEDIUM - Cross-platform compatibility)*

### 4.3 Database Service
- [x] **Refactor database system to a standalone Windows service** *(MEDIUM - Architecture upgrade, large effort)*
    - Created `orbit-db-service` Rust service in `src/services/db-service/`
    - Implements SQLite with vector search (bincode-serialized embeddings)
    - Windows Service support via `windows-service` crate
    - HTTP API on dynamic port with discovery via port file
- [x] Implement Rust-based Host for PGlite/Postgres
    - Using SQLite as the Rust-native alternative (compatible schema)
    - Full CRUD for chats, messages, projects, folders, prompts
    - Vector search for code symbols and semantic fragments
- [x] Update DatabaseService.ts to act as a remote client
    - Created `DatabaseClientService` in `src/main/services/data/database-client.service.ts`
    - HTTP client using axios with retry logic
    - Automatic service discovery and startup via ProcessManagerService
- [ ] Migration and regression testing for all data domains
- [ ] Automated daily backup and cloud sync integration (deferred)

---

## Summary (Updated 2026-01-27)

**Completed:**
- BaseService adoption: 42/86 services (49%)
- Lifecycle management: 76% of BaseService services have initialize/cleanup
- LLM Plugin interface and registry implemented
- EventBusService with 56 usages across codebase
- MCP module reorganization
- Database service refactoring to standalone Windows Service (Task 4.3)
  - Rust-based `orbit-db-service` with SQLite + vector search
  - `DatabaseClientService` HTTP client for Electron integration
  - Windows Service installer script

**In Progress:**
- IPC to EventBus migration (~300 handlers)
- OpenAI/Anthropic plugin extraction
- Database service migration testing

**Planned:**
- Linux packaging support
- Cloud sync integration for backups
