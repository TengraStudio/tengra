# Architecture Roadmap

## CRITICAL - Service Layer

### 1.1 Service Categorization
- [x] Move services to domain folders (services/system, services/data, etc.)
- [x] Standardize Service Naming (.service.ts convention)
    - Renamed chat-queue.manager.ts to chat-queue.service.ts
    - Renamed migration-manager.ts to db-migration.service.ts

### 1.2 BaseService Adoption
- [x] Extend BaseService for all services (30+ verified)
- [ ] Ensure strict lifecycle management (initialize/dispose) - 20/39 complete (51%)

## HIGH - Event System

### 2.1 Central Event Bus
- [x] Create EventBusService with enhanced features
- [x] Define global event types OrbitEvent  
- [x] Add subscription management with IDs and cleanup
- [x] Add event persistence for debugging
- [ ] Replace scattered IPC events with central bus

## MEDIUM - Plugin Architecture

### 3.1 LLM Plugins
- [ ] Extract OpenAI/Anthropic logic into Plugins
- [ ] Define LLMProviderPlugin interface
- [ ] Create Plugin Registry

### 3.2 MCP System
- [x] Reorganize src/main/mcp into proper module structure
- [x] Create mcp/index.ts aggregator
- [ ] Extract tools into mcp/servers/ (FileSystem, Git, etc.) [SKIPPED - too risky to refactor]

## LOW - Infrastructure

### 4.1 Background Services
- [x] Design Token Refresh Daemon (Windows Service/Task) - Phase 20
- [x] Design Model Registry Daemon - Phase 20

### 4.2 Linux Support
- [ ] Plan Linux packaging (AppImage, Deb)
- [ ] Test native modules on Linux

### 4.3 Database Service
- [ ] Refactor database system to a standalone Windows service
- [ ] Implement Rust-based Host for PGlite/Postgres
- [ ] Update DatabaseService.ts to act as a remote client
- [ ] Migration and regression testing for all data domains
