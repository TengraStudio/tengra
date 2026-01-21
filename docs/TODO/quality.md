# Code Quality & Technical Debt

## 🔴 CRITICAL - Type Safety

- [x] Remove `any` type usage in critical paths
    - [x] `database.service.ts`: ~10 instances (some intentionally annotated)
    - [x] `llm.service.ts`: Fixed 1 instance
    - [x] `quota.service.ts`: Fixed 2 instances
    - [x] `health-check.service.ts`: Fixed 2 instances
    - [x] `ollama-health.service.ts`: Fixed 2 instances
    - [x] `shared/types/events.ts`: Fixed 1 instance
- [ ] Enable `noImplicitAny` in tsconfig
- [ ] Strict null checks

## 🔴 CRITICAL - Testing

- [x] Fix Test Import Paths
- [ ] **Coverage**: Increase from <30% to 60%
- [ ] **E2E Tests**:
    - [x] Chat flow
    - [ ] Settings persistence
    - [ ] Project creation
    - [ ] Model switching
- [ ] **Unit Tests**:
    - Add tests for UI components (ChatView, Sidebar)

---

## 🟠 HIGH - Performance

- [x] **Bundle Size**: Optimized via code splitting (Phase 16)
- [ ] **Render Performance**:
    - Virtualize chat list
    - Memoize Sidebar components
- [ ] **Startup Time**:
    - Lazy load more services
    - Optimize initial database connection

---

## 🟡 MEDIUM - Clean Code

- [ ] **Linting**:
    - [x] Fix ESLint config
    - [ ] Enforce import ordering
    - [ ] Standardize semicolon usage
- [ ] **Documentation**:
    - Add JSDoc to public service methods
    - Generate API documentation

---

## 🟢 LOW - Refactoring

- [ ] Consolidate duplicate utilities
- [ ] Remove dead code (commented blocks)
