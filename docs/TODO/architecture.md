# Architecture Roadmap

## 🔴 CRITICAL - Service Layer

### 1.1 Service Categorization
- [x] Move services to domain folders (`services/system`, `services/data`, etc.)
- [ ] Standardize Service Naming (`.service.ts` vs `.manager.ts`)
    - Rename `chat-queue.manager.ts` -> `chat-queue.service.ts`
    - Rename `migration-manager.ts` -> `migration.service.ts`

### 1.2 BaseService Adoption
- [x] Extend `BaseService` for all services (30+ verified)
- [ ] Ensure strict lifecycle management (initialize/dispose)

---

## 🟠 HIGH - Event System

### 2.1 Central Event Bus
- [ ] Create `EventBusService`
- [ ] Define global event types `OrbitEvent`
- [ ] Replace scattered IPC events with central bus
- [ ] Add event persistence for debugging

---

## 🟡 MEDIUM - Plugin Architecture

### 3.1 LLM Plugins
- [ ] Extract OpenAI/Anthropic logic into Plugins
- [ ] Define `LLMProviderPlugin` interface
- [ ] Create Plugin Registry

### 3.2 MCP System
- [ ] Reorganize `src/main/mcp` into proper module structure
- [ ] Extract tools into `mcp/servers/` (FileSystem, Git, etc.)
- [ ] Create `mcp/index.ts` aggregator

---

## 🟢 LOW - Infrastructure

### 4.1 Background Services
- [x] Design Token Refresh Daemon (Windows Service/Task) ✅ Phase 20
- [x] Design Model Registry Daemon ✅ Phase 20

### 4.2 Linux Support
- [ ] Plan Linux packaging (AppImage, Deb)
- [ ] Test native modules on Linux
