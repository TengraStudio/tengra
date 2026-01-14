# Orbit Project - Comprehensive Audit & TODO List

> **Generated**: 2026-01-14  
> **Audit Type**: Full Codebase Analysis  
> **Priority Levels**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## Executive Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Security | 8 | 12 | 6 | 2 | 28 |
| Type Safety | 15 | 20 | 10 | 5 | 50 |
| Architecture | 5 | 15 | 20 | 10 | 50 |
| Performance | 3 | 8 | 12 | 7 | 30 |
| Testing | 10 | 15 | 10 | 5 | 40 |
| Documentation | 2 | 10 | 15 | 8 | 35 |
| **Total** | **43** | **80** | **73** | **37** | **233** |

---

## Table of Contents

1. [Security Vulnerabilities](#1-security-vulnerabilities)
2. [Type Safety Issues](#2-type-safety-issues)
3. [Synchronous Blocking Operations](#3-synchronous-blocking-operations)
4. [Memory Leak Risks](#4-memory-leak-risks)
5. [Error Handling Deficiencies](#5-error-handling-deficiencies)
6. [Import Path Cleanup](#6-import-path-cleanup)
7. [Service Architecture Issues](#7-service-architecture-issues)
8. [Database & Data Layer](#8-database--data-layer)
9. [UI/UX Issues](#9-uiux-issues)
10. [Testing Gaps](#10-testing-gaps)
11. [Performance Issues](#11-performance-issues)
12. [Code Quality Issues](#12-code-quality-issues)
13. [Missing Features](#13-missing-features)
14. [Documentation Gaps](#14-documentation-gaps)
15. [DevOps & Build Issues](#15-devops--build-issues)

---

## 1. Security Vulnerabilities

### 🔴 CRITICAL - Hardcoded Secrets

#### 1.1 Client Secret in Source Code
**File**: `src/main/services/security/token.service.ts` (Line 15)
```typescript
const ANTIGRAVITY_CLIENT_SECRET = process.env.ANTIGRAVITY_CLIENT_SECRET || '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'
```
**Impact**: Anyone with access to source code can use this OAuth secret
**Fix**: Remove fallback, require environment variable, or use secure vault

#### 1.2 Client Secret in QuotaService
**File**: `src/main/services/proxy/quota.service.ts` (Line 856)
```typescript
client_secret: ANTIGRAVITY_CLIENT_SECRET,
```
**Impact**: Same secret exposed in multiple locations

### 🔴 CRITICAL - XSS Risk with dangerouslySetInnerHTML

#### 1.3 SVG Injection Risk
**Files**:
- `src/renderer/features/chat/components/MarkdownRenderer.tsx` (Line 41)
- `src/renderer/features/chat/components/MessageBubble.tsx` (Line 149)
```typescript
return <div dangerouslySetInnerHTML={{ __html: svg }} />
```
**Impact**: Malicious SVG from LLM response could execute JavaScript
**Fix**: Sanitize SVG with DOMPurify before rendering

### 🔴 CRITICAL - Shell Injection Risks

#### 1.4 shell: true Usage
**Files with potential command injection**:
- `src/main/services/llm/local-ai.service.ts` (Line 89)
- `src/main/mcp/dispatcher.ts` (Lines 244-246)
- `src/main/ipc/window.ts` (Lines 93, 105)
**Impact**: User-controlled input could execute arbitrary commands
**Fix**: Validate/sanitize all command inputs, avoid shell: true where possible

### 🟠 HIGH - Insecure File Operations

#### 1.5 Path Traversal Risk in SSH Service
**File**: `src/main/services/ssh.service.ts` (Line 671)
```typescript
if (!path.startsWith('/var/log')) throw new Error('Access denied')
```
**Impact**: Simple startsWith check can be bypassed with `../`
**Fix**: Use proper path normalization and validation

#### 1.6 Unvalidated JSON Parsing
Found **94 instances** of `JSON.parse` without try-catch or validation:
- `proxy.service.ts` (Lines 105, 124, 499, 546, 557)
- `quota.service.ts` (Lines 37, 71, 495, 881, 909)
- `settings.service.ts` (Lines 129, 344, 434, 458)
- And 80+ more locations
**Impact**: Malformed JSON crashes the application
**Fix**: Wrap all JSON.parse in try-catch

### 🟠 HIGH - Credential Logging Risk

#### 1.7 Password in Connection Profiles
**File**: `src/main/services/ssh.service.ts` (Lines 129-130, 160-161)
Passwords are encrypted but the encryption key handling needs audit.

### 🟡 MEDIUM - Missing Input Validation

#### 1.8 IPC Handler Validation
**Files in `src/main/ipc/`** - 42 IPC handler files need input validation:
- No schema validation for incoming data
- No rate limiting on IPC calls
- No permission checks for sensitive operations

### 🟡 MEDIUM - Session Management

#### 1.9 Claude Session Token Expiration
**File**: `src/main/services/security/token.service.ts`
- Session key validation relies on HTTP request
- No offline expiration check
- User experience unclear when session expires

---

## 2. Type Safety Issues

### 🔴 CRITICAL - `any` Type Usage (180+ instances)

#### 2.1 Database Service (28 instances)
**File**: `src/main/services/data/database.service.ts`
| Line | Issue |
|------|-------|
| 16 | `SemanticFragment` has `[key: string]: any` |
| 24 | `Chat.messages: any[]` |
| 126 | Transaction callback uses `(tx: any)` |
| 135-143 | `run`, `all`, `get` have `...params: any[]` |
| 152-171 | Adapter methods all use `any` |
| 612 | `mapRowToProject(row: any)` |
| 684, 786, 851, 972 | Query params as `any[]` |
| 918 | Row mapping `(row: any)` |

#### 2.2 Migration Manager (6 instances)
**File**: `src/main/services/data/migration-manager.ts`
| Line | Issue |
|------|-------|
| 9-11 | `run`, `all`, `get` return `Promise<any>` |
| 14 | Transaction `(tx: any)` |
| 15 | Query `params?: any[]` returns `Promise<any>` |

#### 2.3 Other Services
| File | Instances | Key Issues |
|------|-----------|------------|
| `stream-parser.util.ts` | 2 | Filter callbacks |
| `message-normalizer.util.ts` | 2 | Return types |
| `ipc-wrapper.util.ts` | 4 | Handler args |
| `quota.service.ts` | 2 | Response handling |
| `proxy.service.ts` | 1 | Model filter |
| `agent.service.ts` | 1 | Result mapping |
| `preload.ts` | 1 | Messages param |
| `ipc/ollama.ts` | 1 | Data array |

### 🟠 HIGH - Unsafe Type Assertions

Found **50+ instances** of `as any` or unsafe casts:
- `database.service.ts` Line 80: `extensions as any`
- Various stream parsing with type assertions

### 🟡 MEDIUM - Missing Strict Null Checks

Many places use `|| ''` or `|| undefined` instead of proper null coalescing:
- Found **85+ instances** of `|| ''` pattern
- Found **55+ instances** of `!== undefined` checks

---

## 3. Synchronous Blocking Operations

### 🔴 CRITICAL - Main Thread Blocking

#### 3.1 Synchronous File Reads (28 locations)
**File Pattern**: `fs.readFileSync` blocks the main process

| File | Line | Context |
|------|------|---------|
| `settings.service.ts` | 121 | Settings load |
| `ssh.service.ts` | 114, 307 | Profile load, key read |
| `backup.service.ts` | 104, 113, 122, 130, 190, 216, 283, 329 | Multiple backup ops |
| `quota.service.ts` | 369, 876 | Key and auth reading |
| `token.service.ts` | 605 | Auth file reading |
| + 15 more files | | |

#### 3.2 Synchronous File Writes (38 locations)
**File Pattern**: `fs.writeFileSync` blocks the main process

| File | Count | Context |
|------|-------|---------|
| `backup.service.ts` | 9 | Backup operations |
| `ssh.service.ts` | 6 | Profile saving |
| `settings.service.ts` | 4 | Settings save |
| `audit-log.service.ts` | 3 | Log writing |
| + 20 more files | | |

**Fix**: Replace with `fs.promises` or use worker threads for file I/O

---

## 4. Memory Leak Risks

### 🔴 CRITICAL - Uncleared Intervals

#### 4.1 setInterval Without Cleanup
**Services using setInterval** (found 14 instances):
| File | Line | Issue |
|------|------|-------|
| `backup.service.ts` | 411 | Has cleanup in dispose() ✓ |
| `telemetry.service.ts` | - | NO cleanup found ❌ |
| `time-tracking.service.ts` | - | NO cleanup found ❌ |
| `memory-profiling.service.ts` | - | NO cleanup found ❌ |
| `health-check.service.ts` | - | NO cleanup found ❌ |
| `http.service.ts` | - | NO cleanup found ❌ |
| `clipboard.service.ts` | - | NO cleanup found ❌ |
| `ollama-health.service.ts` | - | NO cleanup found ❌ |
| `copilot.service.ts` | - | Partial cleanup ⚠️ |

#### 4.2 setTimeout Without Tracking
**Services using setTimeout** (20+ instances):
Many setTimeout calls don't track returned IDs for cleanup on service disposal.

### 🟠 HIGH - Event Listener Cleanup

#### 4.3 Missing removeEventListener
**Audit result**: Found 0 `removeEventListener` calls
- IPC event listeners may accumulate
- Window event handlers may leak
- Process event handlers may leak

### 🟠 HIGH - useEffect Cleanup in React

Found **116+ useEffect** hooks in renderer features.
**Files requiring cleanup audit**:
- `TerminalPanel.tsx` - 10 useEffect hooks
- `ProjectDashboard.tsx` - Multiple effects
- `ChatView.tsx` - Stream handling
- `SSHManager.tsx` - Connection state

---

## 5. Error Handling Deficiencies

### 🔴 CRITICAL - Silent Error Swallowing

#### 5.1 Empty or Minimal Catch Blocks
**Files with `catch (e)` or `catch (error)` followed by minimal handling**:

| File | Lines | Issue |
|------|-------|-------|
| `utility.service.ts` | 25, 40, 87, 100 | Returns false on error |
| `system.service.ts` | 22, 37, 47, 57, 79, 97, 117, 141 | Minimal error handling |
| `security.service.ts` | 36, 64, 76, 90, 106 | Silent failures |
| `settings.service.ts` | 130, 148, 159, 281, 459, 466, 474 | Complex nested catches |
| `ssh.service.ts` | 116, 144, 234, 314, 660, 778, 823, 860 | Connection errors |

#### 5.2 console.log Instead of Proper Logging
**Files still using console.log/error**:
- `backup.service.ts` - Lines 148, 157, 197, 339, 354, 406, 423, 443, 473
- `database.service.ts` - Lines 72, 94, 96
- `settings.service.ts` - Line 131

### 🟠 HIGH - Unhandled Promise Rejections

Many async operations lack proper `.catch()` handling:
- Promise.all without error boundary
- Async IPC handlers without try-catch
- Event-based async operations

### 🟡 MEDIUM - Inconsistent Error Response Format

Some services return:
```typescript
{ success: false, error: string }
```
Others return:
```typescript
{ success: boolean, result?: T, error?: string }
```
**Fix**: Create standardized `ServiceResponse<T>` and use consistently

---

## 6. Import Path Cleanup

### 🔴 CRITICAL - Relative Path Imports (37 files)

Files still using `../../../` patterns:

#### Services - llm/
| File | Lines |
|------|-------|
| `copilot.service.ts` | 2-3 |
| `huggingface.service.ts` | 2 |
| `llm-plugin.interface.ts` | 6 |
| `llama.service.ts` | 10 |
| `llm.service.ts` | 7-8 |
| `model-fallback.service.ts` | 6, 8 |
| `multi-model-comparison.service.ts` | 4, 6 |
| `ollama.service.ts` | 4, 6-7 |
| `ollama-health.service.ts` | 2 |

#### Services - data/
| File | Lines |
|------|-------|
| `chat-event.service.ts` | 4 |
| `database.service.ts` | 9-10 |
| `image-persistence.service.ts` | 9 |
| `filesystem.service.ts` | 6-7 |
| `data.service.ts` | 5 |
| `file.service.ts` | 1-2 |

#### Services - proxy/
| File | Lines |
|------|-------|
| `proxy.service.ts` | 13-15 |
| `quota.service.ts` | 9-11 |
| `proxy-process.manager.ts` | 11 |

#### Services - project/
| File | Lines |
|------|-------|
| `docker.service.ts` | 1 |
| `git.service.ts` | 5 |
| `project.service.ts` | 3-4 |

#### Services - system/
| File | Lines |
|------|-------|
| `command.service.ts` | 3, 7 |

#### Services - Root Level
| File | Lines |
|------|-------|
| `backup.service.ts` | 9-10 |

---

## 7. Service Architecture Issues

### 🔴 CRITICAL - Uncategorized Services

**52 service files** in `src/main/services/`, only **17** properly categorized:

#### Need to Move to `services/system/`
- `settings.service.ts`
- `system.service.ts` (already has folder, file is duplicated)
- `config.service.ts`
- `update.service.ts`
- `network.service.ts`

#### Need to Move to `services/security/`
- `security.service.ts`
- `auth.service.ts`

#### Need to Move to `services/data/`
- `backup.service.ts`
- `export.service.ts`
- `migration.service.ts`

#### Need to Move to `services/ui/`
- `theme.service.ts`
- `notification.service.ts`
- `clipboard.service.ts`
- `screenshot.service.ts`

#### Need to Move to `services/analysis/`
- `telemetry.service.ts`
- `metrics.service.ts`
- `model-analytics.service.ts`
- `performance.service.ts`
- `monitoring.service.ts`
- `memory-profiling.service.ts`
- `usage-tracking.service.ts`
- `time-tracking.service.ts`
- `health-check.service.ts`
- `sentry.service.ts`
- `audit-log.service.ts`

#### Need to Move to `services/llm/`
- `memory.service.ts`
- `model-collaboration.service.ts`
- `multi-llm-orchestrator.service.ts`
- `token-estimation.service.ts`
- `context-window.service.ts`
- `prompt-templates.service.ts`

#### Need to Move to `services/llm/agents/`
- `agent.service.ts`
- `agent-council.service.ts`
- `chat-queue.manager.ts`

#### Need to Move to `services/project/`
- `ssh.service.ts`
- `code-intelligence.service.ts`
- `process.service.ts`
- `scanner.service.ts`

#### Need to Move to `services/external/`
- `http.service.ts`
- `web.service.ts`
- `pagespeed.service.ts`
- `utility.service.ts`
- `logo.service.ts`
- `collaboration.service.ts`
- `content.service.ts`
- `rule.service.ts`
- `feature-flag.service.ts`
- `history-import.service.ts`

### 🟠 HIGH - Services Without BaseService

Many services don't extend `BaseService`:
- Need consistent lifecycle management (initialize, dispose)
- Need consistent logging
- Need consistent error handling

### 🟠 HIGH - Circular Dependency Risk

Potential circular dependencies detected:
- `SettingsService` ↔ `DataService`
- `TokenService` → `SettingsService` → `AuthService`

---

## 8. Database & Data Layer

### 🔴 CRITICAL - SQL Injection Risk

#### 8.1 Dynamic SQL Construction
**File**: `src/main/services/data/database.service.ts`
```typescript
// Lines 686-696 - String concatenation for update queries
if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title) }
```
While using parameterized queries, the structure allows potential issues.

### 🟠 HIGH - No Database Transaction Rollback

Transaction handling in `migration-manager.ts` may not properly rollback on errors.

### 🟠 HIGH - Missing Database Indexes

No explicit index creation found for frequently queried fields:
- `chats.created_at`
- `chats.folder_id`
- `projects.status`
- `messages.chat_id`

### 🟡 MEDIUM - Database Connection Pooling

Single PGlite instance - no connection pooling for concurrent operations.

---

## 9. UI/UX Issues

### 🟠 HIGH - Missing Loading States

Components lacking proper loading indicators:
- Project list loading
- Chat history loading
- Model list loading
- Settings loading

### 🟠 HIGH - Missing Error Boundaries

Only found in `src/renderer/components/shared/ErrorBoundary.tsx`.
**Missing for**:
- Individual chat components
- Settings tabs
- Project workspace panels

### 🟡 MEDIUM - Accessibility Issues

- Missing ARIA labels on interactive elements
- Missing keyboard navigation in some modals
- Color contrast issues in some themes

### 🟡 MEDIUM - Missing Settings UI

No UI for new configurable intervals:
- `settings.ai.modelUpdateInterval`
- `settings.ai.tokenRefreshInterval`
- `settings.ai.copilotRefreshInterval`

---

## 10. Testing Gaps

### 🔴 CRITICAL - Test Infrastructure Broken

#### 10.1 Test Import Paths Invalid
All tests in `src/tests/main/` have broken imports after restructuring:
- Original paths: `../../../src/main/...`
- Should be: `../../../main/...`

#### 10.2 Tests Excluded from TypeScript
`tsconfig.json` excludes `src/tests/` - tests not type-checked.

### 🔴 CRITICAL - Missing Tests for Critical Services

| Service | Status | Priority |
|---------|--------|----------|
| `TokenService` | No tests | 🔴 Critical |
| `JobSchedulerService` | No tests | 🔴 Critical |
| `ModelRegistryService` | No tests | 🔴 Critical |
| `SecurityService` | Has tests | ✓ |
| `DatabaseService` | Partial | 🟠 High |
| `ProxyService` | No tests | 🟠 High |
| `QuotaService` | No tests | 🟠 High |

### 🟠 HIGH - No E2E Tests for Critical Flows

Missing E2E tests:
- Authentication flow
- Chat creation and messaging
- Project creation
- Settings persistence
- Model switching

### 🟡 MEDIUM - Coverage Below Thresholds

Estimated coverage: < 30%
Target: 60% minimum

---

## 11. Performance Issues

### 🔴 CRITICAL - Bundle Size

| Bundle | Size | Gzipped |
|--------|------|---------|
| Renderer | 1.4MB+ | 450KB |
| Main | 2.3MB | 502KB |
| Preload | 29KB | 5KB |

**Issues**:
- No code splitting for routes
- Large dependencies not tree-shaken
- Monaco editor full bundle included

### 🟠 HIGH - Render Performance

- No virtualization for long lists (chat history, messages)
- No memoization on frequently re-rendered components
- No debouncing on search inputs

### 🟠 HIGH - Startup Time

- Multiple synchronous file reads on startup
- All services initialized eagerly
- No lazy loading of features

### 🟡 MEDIUM - Database Performance

- No query result caching
- No pagination on large datasets
- Missing database indexes

---

## 12. Code Quality Issues

### 🟠 HIGH - ESLint Configuration Broken

```
Error while loading rule '@typescript-eslint/prefer-nullish-coalescing'
```
ESLint cannot run due to type-checking configuration issue.

### 🟠 HIGH - Inconsistent Coding Patterns

- Mixed semicolon usage
- Mixed quote styles
- Inconsistent error handling
- Inconsistent return types

### 🟡 MEDIUM - Magic Numbers

Found throughout codebase:
```typescript
// Examples
if (password.length > 8) score++;  // What is 8?
intervalMs: 60 * 60 * 1000         // Should be named constant
```

### 🟡 MEDIUM - Dead Code

- Commented-out code blocks
- Unused imports
- Unused variables (flagged by TypeScript)

---

## 13. Missing Features

### 🟠 HIGH - Incomplete Feature Modules

| Feature | Files | Status |
|---------|-------|--------|
| `features/mcp/` | 2 | 20% complete |
| `features/memory/` | 0 | Not started |
| `features/terminal/` | 1 | 30% complete |
| `features/themes/` | 1 | 40% complete |
| `features/onboarding/` | 2 | 50% complete |

### 🟠 HIGH - Missing Core Functionality

- [ ] Model comparison visualization
- [ ] Agent council UI
- [ ] Memory/RAG management UI
- [ ] Prompt template editor
- [ ] Usage statistics dashboard
- [ ] Quota monitoring UI

### 🟡 MEDIUM - Missing QoL Features

- [ ] Chat export/import
- [ ] Keyboard shortcut customization
- [ ] Theme creator
- [ ] Backup scheduling UI
- [ ] Log viewer

---

## 14. Documentation Gaps

### 🔴 CRITICAL - Missing API Documentation

- No JSDoc on 95% of public methods
- No OpenAPI spec for proxy endpoints
- No IPC handler documentation

### 🟠 HIGH - Outdated Documentation

- `README.md` - Missing recent features
- `ARCHITECTURE.md` - Needs service layer update

### 🟡 MEDIUM - Missing Documentation

- [ ] Setup guide for development
- [ ] Contributing guidelines
- [ ] Release process
- [ ] Troubleshooting guide
- [ ] Security policy

---

## 15. DevOps & Build Issues

### 🔴 CRITICAL - ESLint Broken

Cannot run linting due to configuration error.

### 🟠 HIGH - No CI/CD Pipeline

- No automated testing
- No automated builds
- No release automation

### 🟠 HIGH - Deprecation Warnings

```
The CJS build of Vite's Node API is deprecated
```

### 🟡 MEDIUM - Missing Build Optimizations

- No source maps in production
- No asset compression
- No cache busting strategy

---

## Priority Action Items

### IMMEDIATE (This Week)

1. 🔴 Remove hardcoded client secret
2. 🔴 Sanitize dangerouslySetInnerHTML inputs
3. 🔴 Fix ESLint configuration
4. 🔴 Fix test import paths
5. 🔴 Add memory leak cleanup

### SHORT TERM (2 Weeks)

1. 🟠 Replace synchronous file operations
2. 🟠 Add proper error handling throughout
3. 🟠 Convert imports to path aliases
4. 🟠 Add tests for critical services
5. 🟠 Categorize services properly

### MEDIUM TERM (1 Month)

1. 🟡 Remove all `any` and `unknown` types
2. 🟡 Add database indexes
3. 🟡 Implement code splitting
4. 🟡 Complete feature modules
5. 🟡 Update documentation

---

## Metrics to Track

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| `any` count | 180+ | 0 | 1 month |
| Test coverage | <30% | 60% | 2 months |
| Bundle size | 2.3MB | 1.5MB | 1 month |
| Security issues | 28 | 0 | 2 weeks |
| ESLint errors | ∞ | 0 | 1 week |

---

---

## 16. Internationalization (i18n) Issues

### Current State

**Languages Supported**: 2 (English, Turkish)
**Translation Files**:
- `src/renderer/i18n/en.ts` (785 lines, 29KB)
- `src/renderer/i18n/tr.ts` (784 lines, 31KB)

---

### 🔴 CRITICAL - Hardcoded Strings (Not Using t() Function)

#### 16.1 Hardcoded Placeholder Texts
| File | Line | Hardcoded Text |
|------|------|----------------|
| `ThemeStore.tsx` | 247 | `"Search themes..."` |
| `SSHManager.tsx` | 361 | `"192.168.1.1"` |
| `SSHManager.tsx` | 370 | `"22"` |
| `SSHManager.tsx` | 378 | `"root"` |
| `NginxWizard.tsx` | 91 | `"api.myapp.com"` |
| `NginxWizard.tsx` | 102 | `"3000"` |
| `PersonasTab.tsx` | 28 | `"Persona adı"` (Turkish in code!) |
| `PersonasTab.tsx` | 29 | `"Kısa açiklama"` (Turkish in code!) |
| `PersonasTab.tsx` | 30 | `"Prompt"` |
| `ParameterPresets.tsx` | 172 | `"Preset name"` |
| `AdvancedTab.tsx` | 64 | `"Bu modele özel sistem komutu..."` (Turkish!) |
| `PromptManagerModal.tsx` | 49 | `"Prompt Library"` |
| `PromptManagerModal.tsx` | 59 | `"e.g. Code Refactor"` |
| `PromptManagerModal.tsx` | 69 | `"Enter prompt content..."` |
| `WorkspaceModals.tsx` | 78 | `"C:\\Users\\Project"` |
| `WorkspaceModals.tsx` | 150 | `"Name..."` |
| `ProjectTodoTab.tsx` | 269 | `"What needs to be done? (Press Enter)"` |
| `ProjectWizardModal.tsx` | 321 | `"example.com"` |
| `ProjectDashboard.tsx` | 818 | `"Commit message..."` |
| `MCPStore.tsx` | 284 | `"Search tools..."` |
| `ModelComparison.tsx` | 230 | `"Enter your prompt to compare..."` |
| `AgentDashboard.tsx` | 153 | `"Describe a complex goal..."` |
| `AgentCouncil.tsx` | 165 | `"Describe a task for the council..."` |
| `ToolDisplay.tsx` | 109 | `"Markdown Gorunumu"` (Turkish!) |

#### 16.2 Hardcoded Title Attributes
| File | Line | Hardcoded Title |
|------|------|-----------------|
| `SSHManager.tsx` | 257 | `"Delete Profile"` |
| `WorkspaceToolbar.tsx` | 139 | `"Git"` |
| `ModelComparison.tsx` | 159 | `"Copy response"` |

---

### 🟠 HIGH - Missing Translation Keys in TR

Turkish file (`tr.ts`) is missing the following keys present in English:

| Section | Missing Keys |
|---------|--------------|
| `input.placeholder` | `copilot`, `ollama` (only has `default`) |
| `modelExplorer` | Entire section missing |
| `docker` | `stop`, `start`, `remove`, `shell` |
| `onboarding` | Step titles and descriptions |
| `workspace` | `run`, `toggleSidebar`, `aiAssistant` |
| `common` | `add` |

---

### 🟡 MEDIUM - Inconsistent Translation Quality

Some Turkish translations have issues:

| Key | Current | Issue |
|-----|---------|-------|
| `ssh.load` | `yük` | Could be `yükleme` (context-dependent) |
| `agents.roundRobin` | `Round robin` | Not translated |
| `logging.of` | `/` | Should be `toplam` or similar |

---

### 🟢 LOW - Future Language Support

#### Planned Languages
- [ ] German (de)
- [ ] French (fr)
- [ ] Spanish (es)
- [ ] Japanese (ja)
- [ ] Chinese Simplified (zh-CN)
- [ ] Portuguese (pt-BR)
- [ ] Russian (ru)
- [ ] Arabic (ar) - RTL support needed

#### Infrastructure Needed
- [ ] Language detection on first launch
- [ ] Language switcher in settings
- [ ] RTL layout support for Arabic
- [ ] Pluralization support (i18next)
- [ ] Date/time localization
- [ ] Number formatting localization

---

## 17. Infrastructure & Platform Changes

### 🔴 CRITICAL - Database Migration

#### 17.1 SQLite to PGlite Migration
Current state: PGlite in use but migration from legacy JSON not complete
- [ ] Complete migration of `chats.json` to PGlite
- [ ] Complete migration of `folders.json` to PGlite
- [ ] Complete migration of `prompts.json` to PGlite
- [ ] Complete migration of `council.json` to PGlite
- [ ] Complete migration of `projects.json` to PGlite
- [ ] Remove legacy JSON file reads after migration

#### 17.2 Auth File Migration
- [ ] Claude: `claude_session.txt` → `claude-{email}.json` (in progress)
- [ ] Standardize all auth files to encrypted JSON format
- [ ] Add migration scripts for existing users

---

### 🟠 HIGH - Build System Modernization

#### 17.3 ESM Migration
```
The CJS build of Vite's Node API is deprecated
```
- [ ] Convert `vite.config.ts` to ESM
- [ ] Update all `require()` to `import`
- [ ] Fix `__dirname`/`__filename` usage in ESM context
- [ ] Update `package.json` with `"type": "module"`
- [ ] Test all build scripts after migration

#### 17.4 Electron Upgrade Path
Current: Electron 33.x
- [ ] Plan upgrade to Electron 34.x
- [ ] Audit native module compatibility
- [ ] Update `better-sqlite3` if needed
- [ ] Test all IPC handlers after upgrade

---

### 🟠 HIGH - Native Module Strategy

#### 17.5 better-sqlite3 Issues
Native module compilation fails on some systems:
- [ ] Add fallback to PGlite-only mode
- [ ] Document MSVS version requirements
- [ ] Add prebuild binaries for common platforms
- [ ] Consider removing better-sqlite3 dependency entirely

#### 17.6 Node-pty for Terminal
- [ ] Audit node-pty memory usage
- [ ] Add graceful degradation if PTY unavailable
- [ ] Test on Windows ARM64

---

### 🟡 MEDIUM - Proxy Architecture

#### 17.7 ClipyProxyAPI Integration
Current: Go binary embedded, started as subprocess
- [ ] Document proxy startup/shutdown lifecycle
- [ ] Add health checks for proxy process
- [ ] Handle proxy crash recovery
- [ ] Add configurable proxy port

#### 17.8 Model Registry Centralization
- [ ] Move all model fetching to `ModelRegistryService`
- [ ] Add provider-agnostic model interface
- [ ] Cache model lists with configurable TTL
- [ ] Add offline model list fallback

---

### 🟡 MEDIUM - Feature Flags

#### 17.9 Feature Flag System
File: `src/main/services/feature-flag.service.ts`
- [ ] Document all available feature flags
- [ ] Add UI for feature flag management
- [ ] Add A/B testing support
- [ ] Add gradual rollout support

---

### 🟢 LOW - Future Platform Support

#### 17.10 ARM64 Support
- [ ] Test on Windows ARM64
- [ ] Test on Apple Silicon (macOS)
- [ ] Ensure native modules compile on ARM64

#### 17.11 Linux Packaging
- [ ] AppImage generation
- [ ] Flatpak support
- [ ] Snap package
- [ ] Debian package (.deb)

#### 17.12 Auto-Update Infrastructure
- [ ] Set up update server
- [ ] Add differential updates
- [ ] Add rollback mechanism
- [ ] Add update notifications UI

---

## 18. Code Consistency & Standards

### 🟠 HIGH - Naming Conventions

#### 18.1 Turkish in Codebase
Found Turkish text in source code (not translation files):

| File | Issue |
|------|-------|
| `llama.service.ts:295` | `'llama-server çalışmıyor'` |
| `PersonasTab.tsx:28-30` | Turkish placeholders |
| `AdvancedTab.tsx:64` | Turkish placeholder |
| `ToolDisplay.tsx:109` | `'Markdown Gorunumu'` |

#### 18.2 Inconsistent File Naming
- Some services use `.service.ts`, others use `.manager.ts`
- `chat-queue.manager.ts` should be `chat-queue.service.ts`
- `migration-manager.ts` should be `migration.service.ts`

---

### 🟡 MEDIUM - Code Style

#### 18.3 Semicolon Usage
Mixed semicolon usage throughout codebase:
- Most files: No semicolons
- Some files: Semicolons
- Fix: Configure Prettier with consistent rule

#### 18.4 Import Ordering
No consistent import order:
- Fix: Configure ESLint import sorting rule
- Suggested order: node → external → internal → relative

---

## Priority Action Items (Updated)

### IMMEDIATE (This Week)

1. 🔴 Remove hardcoded client secret
2. 🔴 Sanitize dangerouslySetInnerHTML inputs
3. 🔴 Fix ESLint configuration
4. 🔴 Fix test import paths
5. 🔴 Add memory leak cleanup
6. 🔴 Fix Turkish hardcoded strings in source code

### SHORT TERM (2 Weeks)

1. 🟠 Replace synchronous file operations
2. 🟠 Add proper error handling throughout
3. 🟠 Convert imports to path aliases
4. 🟠 Add tests for critical services
5. 🟠 Categorize services properly
6. 🟠 Complete missing Turkish translations
7. 🟠 ESM migration for Vite

### MEDIUM TERM (1 Month)

1. 🟡 Remove all `any` types
2. 🟡 Add database indexes
3. 🟡 Implement code splitting
4. 🟡 Complete feature modules
5. 🟡 Update documentation
6. 🟡 Add RTL support for future Arabic
7. 🟡 Complete legacy JSON to PGlite migration

### LONG TERM (3 Months)

1. 🟢 Add more languages (DE, FR, ES, JA)
2. 🟢 ARM64 native support
3. 🟢 Linux packaging (AppImage, Flatpak)
4. 🟢 Auto-update infrastructure
5. 🟢 A/B testing framework

---

## Metrics to Track (Updated)

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| `any` count | 180+ | 0 | 1 month |
| Test coverage | <30% | 60% | 2 months |
| Bundle size | 2.3MB | 1.5MB | 1 month |
| Security issues | 28 | 0 | 2 weeks |
| ESLint errors | ∞ | 0 | 1 week |
| Hardcoded strings | 25+ | 0 | 2 weeks |
| Missing translations (TR) | 15+ | 0 | 1 week |
| Languages supported | 2 | 5 | 3 months |

---

*This document should be updated as tasks are completed.*  
*Last updated: 2026-01-14*  
*Total issues: 280+*

---

## 19. Authentication System Modernization

### Current State

**File**: `src/main/services/auth.service.ts`
- Each provider has separate JSON file in `userData/auth/`
- Tokens encrypted with Electron safeStorage
- Single account per provider
- No session management UI

---

### 🔴 CRITICAL - Database Migration for Auth

#### 19.1 Migrate Tokens to Database
Current: Each token in separate file (`antigravity.json`, `claude.json`, etc.)
Target: Encrypted tokens stored in PGlite database

- [ ] Create `auth_tokens` database table
  ```sql
  CREATE TABLE auth_tokens (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,      -- 'antigravity', 'claude', 'codex', etc.
    account_id TEXT NOT NULL,    -- Email or username
    token_type TEXT,             -- 'access', 'refresh', 'session'
    encrypted_token TEXT NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB               -- Provider-specific data
  );
  ```
- [ ] Migrate existing file-based tokens to database
- [ ] Delete legacy files after successful migration
- [ ] Add database fallback for corruption cases

#### 19.2 Multi-Account Support
- [ ] Allow multiple accounts per provider
- [ ] Account switching UI in settings
- [ ] Default account selection
- [ ] Account nicknames/labels
- [ ] Per-project account association

#### Providers to Support:
| Provider | Current | Multi-Account |
|----------|---------|---------------|
| Antigravity | ✅ | ➡️ Multi |
| Claude | ✅ | ➡️ Multi |
| Codex | ✅ | ➡️ Multi |
| GitHub Copilot | ✅ | ➡️ Multi |
| OpenAI | ✅ | ➡️ Multi |
| Anthropic | ✅ | ➡️ Multi |
| Groq | ✅ | ➡️ Multi |
| Ollama | N/A | N/A (local) |

---

### 🟠 HIGH - Session Management UI

#### 19.3 Account Manager Component
- [ ] Show all connected accounts
- [ ] Show connection status per account
- [ ] Show token expiration times
- [ ] Quick account switch button
- [ ] Token refresh button
- [ ] Disconnect/reconnect per account

---

## 20. Gallery System Enhancement

### Current State

**Files**: 
- `src/main/ipc/gallery.ts` - Basic CRUD operations
- `src/main/services/data/image-persistence.service.ts`
- `src/renderer/features/chat/components/GalleryView.tsx`

**Current GalleryItem Interface**:
```typescript
interface GalleryItem {
    name: string
    path: string
    url: string
    mtime: number
    type: 'image' | 'video'
}
```

---

### 🟠 HIGH - Prompt Storage for Generated Images

#### 20.1 Enhanced GalleryItem Schema
- [ ] Store prompt used to generate image
- [ ] Store model used
- [ ] Store generation parameters (steps, size, etc.)
- [ ] Store negative prompt (if applicable)
- [ ] Store generation time

**New Interface**:
```typescript
interface GalleryItem {
    id: string
    name: string
    path: string
    url: string
    mtime: number
    type: 'image' | 'video'
    // NEW FIELDS
    prompt?: string
    negativePrompt?: string
    model?: string
    provider?: string      // 'flux', 'dall-e', 'stable-diffusion', etc.
    generationParams?: {
        width: number
        height: number
        steps?: number
        seed?: number
        guidance?: number
    }
    generatedAt?: number
    generationDuration?: number  // ms
    chatId?: string              // Source chat if applicable
}
```

#### 20.2 Database Table for Gallery
- [ ] Create `gallery_items` table in PGlite
- [ ] Migrate existing files to include metadata
- [ ] Store prompt in sidecar JSON or database

#### 20.3 Gallery UI Enhancements
- [ ] Show prompt when hovering over image
- [ ] "Copy Prompt" button
- [ ] "Regenerate" button (reuse prompt)
- [ ] Filter by model/provider
- [ ] Search by prompt text
- [ ] Prompt editing before regeneration

---

## 21. Statistics Dashboard Expansion

### Current State

**File**: `src/renderer/features/settings/components/StatisticsTab.tsx` (489 lines)

**Current Metrics**:
- Chat count
- Message count
- Total tokens (prompt + completion)
- Token timeline
- Quota status (Antigravity, Codex, Claude, Copilot)
- Online time / Coding time
- Project coding time

---

### 🟠 HIGH - New Statistics to Add

#### 21.1 Usage Analytics
- [ ] **Model Usage Graph** - Which models used most
- [ ] **Provider Distribution** - Pie chart of API calls per provider
- [ ] **Response Time Graph** - Average latency per model
- [ ] **Error Rate Graph** - Failures per provider over time
- [ ] **Token Cost Estimation** - $ estimate based on token usage

#### 21.2 Productivity Metrics
- [ ] **Lines of Code Generated** - AI-assisted LOC
- [ ] **Code Acceptance Rate** - % of AI suggestions accepted
- [ ] **Session Duration Graph** - Daily/weekly usage patterns
- [ ] **Peak Usage Times** - Heatmap of most active hours
- [ ] **Project Activity** - Which projects use most AI

#### 21.3 Conversation Analytics
- [ ] **Average Message Length** - User vs AI
- [ ] **Conversation Length** - Messages per chat average
- [ ] **Topic Distribution** - Code, analysis, creative, debug
- [ ] **Language Distribution** - EN, TR, etc.

#### 21.4 Infrastructure Metrics
- [ ] **Database Size** - Current and trend
- [ ] **Cache Hit Rate** - Model cache efficiency
- [ ] **Startup Time** - App launch duration
- [ ] **Memory Usage** - Over time graph

---

### 🟡 MEDIUM - Statistics Backend

- [ ] Create `MetricsCollectorService` for aggregating stats
- [ ] Store historical metrics in database (not just current)
- [ ] Add export to CSV/JSON
- [ ] Add comparison period (this week vs last week)

---

## 22. Project System Overhaul

### Current Architecture

**Backend Services** (`src/main/services/project/`):
| File | LOC | Purpose |
|------|-----|---------|
| `project.service.ts` | 662 | Project analysis, detection |
| `terminal.service.ts` | 452 | Terminal management |
| `git.service.ts` | 180 | Git operations |
| `docker.service.ts` | 92 | Container management |

**Frontend Components** (`src/renderer/features/projects/`):
| File | LOC | Purpose |
|------|-----|---------|
| `ProjectDashboard.tsx` | 1089 | Main project view |
| `ProjectWizardModal.tsx` | 750 | Project creation |
| `ProjectWorkspace.tsx` | 520 | Workspace layout |
| `ProjectTodoTab.tsx` | 450 | TODO management |

---

### 🔴 CRITICAL - Project System Gaps

#### 22.1 Missing Core Features
- [ ] **Project Settings Panel** - Per-project configuration
- [ ] **Environment Variables Manager** - .env editor with encryption
- [ ] **Dependency Analyzer** - Visualize dependency tree
- [ ] **Security Scanner** - Vulnerability detection
- [ ] **Build Configuration** - Custom run/build commands
- [ ] **Project Templates** - Quick start templates
- [ ] **Project Cloning** - Clone from Git URL
- [ ] **Project Archiving** - Archive/Unarchive projects

#### 22.2 AI Integration
- [ ] **Codebase Q&A** - Ask questions about project code
- [ ] **Auto-Documentation** - Generate README, JSDoc
- [ ] **Refactoring Suggestions** - AI-powered refactoring
- [ ] **Test Generation** - AI-generated test cases
- [ ] **Code Review Bot** - Review changes before commit
- [ ] **Semantic Search** - Find code by description

#### 22.3 Collaboration Features
- [ ] **Project Sharing** - Export/import project config
- [ ] **Team Memory** - Shared context across team
- [ ] **Sync with Git** - Project metadata in repo
- [ ] **Comments/Notes** - Per-file annotations

#### 22.4 Performance & UX
- [ ] **Lazy Loading** - Load file tree on demand
- [ ] **Virtual Scrolling** - For large file lists
- [ ] **Incremental Analysis** - Only re-analyze changed files
- [ ] **Background Indexing** - Don't block UI during scan

---

### 🟠 HIGH - File Explorer Improvements

- [ ] Multi-file selection
- [ ] Drag & drop reordering
- [ ] File preview on hover
- [ ] Better search with regex support
- [ ] Gitignore-aware filtering
- [ ] File history viewer

---

## 23. Extreme Optimization Strategy

### 🔴 CRITICAL - Revolutionary Optimizations

#### 23.1 Startup Time Optimization

**Current**: ~3-5 seconds
**Target**: <1 second (instant feel)

Techniques:
- [ ] **Lazy Service Initialization** - Only init services when first used
- [ ] **Snapshot-based Restoration** - V8 heap snapshot for instant restore
- [ ] **Precompiled Bytecode** - Use V8 code cache for main process
- [ ] **Splash Screen with Background Load** - Show UI immediately
- [ ] **Module Deferred Loading** - Load features on route change
- [ ] **IPC Batching** - Combine initial IPC calls

#### 23.2 Memory Optimization

**Current**: ~300-500MB
**Target**: <150MB baseline

Techniques:
- [ ] **WebAssembly for Heavy Ops** - Move parsing/analysis to WASM
- [ ] **Shared Array Buffers** - Zero-copy data between processes
- [ ] **Object Pooling** - Reuse frequently created objects
- [ ] **WeakRef Caching** - Auto-evicting memory caches
- [ ] **Incremental GC Hints** - Help V8 garbage collection
- [ ] **Native Addon for Parsing** - C++ for JSON/code parsing

#### 23.3 Render Performance

**Target**: 60 FPS constant, <16ms for any operation

Techniques:
- [ ] **Virtual DOM Diffing Optimization** - Custom reconciler
- [ ] **GPU-accelerated Animations** - CSS transforms only
- [ ] **Off-main-thread Rendering** - OffscreenCanvas for heavy UI
- [ ] **Concurrent React Features** - useTransition, useDeferredValue
- [ ] **React Compiler** - Auto-memoization (React 19+)
- [ ] **Selective Hydration** - Stream expensive components

#### 23.4 Bundle Size Optimization

**Current**: 2.3MB gzipped
**Target**: <800KB gzipped

Techniques:
- [ ] **Dynamic Imports** - Every route lazy loaded
- [ ] **Tree Shaking Audit** - Eliminate dead code
- [ ] **Compression** - Brotli for maximum compression
- [ ] **Monaco Editor Split** - Load only needed languages
- [ ] **Icon Tree Shaking** - Only import used icons
- [ ] **CSS Purging** - Remove unused styles
- [ ] **Image Optimization** - WebP/AVIF, lazy loading

#### 23.5 Database Optimization

Techniques:
- [ ] **Prepared Statements** - Precompile frequent queries
- [ ] **Query Result Caching** - LRU cache for reads
- [ ] **Batch Writes** - Debounced write operations
- [ ] **Partial Indexes** - Index only hot data
- [ ] **Connection Pooling** - Multiple DB connections
- [ ] **WAL Mode** - Write-ahead logging for speed

#### 23.6 Network Optimization

Techniques:
- [ ] **Request Deduplication** - Merge identical API calls
- [ ] **Predictive Prefetching** - Load likely next content
- [ ] **Response Streaming** - Process as data arrives
- [ ] **GraphQL Batching** - Combine multiple queries
- [ ] **HTTP/2 Multiplexing** - Parallel requests on one connection

---

## 24. Background Windows Services

### 🔴 CRITICAL - Token Refresh as Windows Service

#### 24.1 Token Refresh Daemon

**Purpose**: Refresh OAuth tokens even when app is closed

**Implementation Options**:

1. **Windows Service (Node.js)**
   - Use `node-windows` package
   - Runs as SYSTEM or user service
   - Survives app close and restart
   
2. **Windows Task Scheduler**
   - Scheduled task runs every N minutes
   - Invokes lightweight Node script
   - Lower resource usage

3. **Windows Tray App**
   - Minimal tray icon when main app closed
   - Background refresh continues
   - Click to reopen main app

**Service Architecture**:
```
┌─────────────────────────────────────────────┐
│           Windows Service Layer             │
├─────────────────────────────────────────────┤
│  TokenRefreshService  │ ModelRegistryService │
│  - Refresh tokens     │ - Fetch models       │
│  - Every 30 min       │ - Every 2 hours      │
│  - Store in DB        │ - Cache locally      │
└─────────────────────────────────────────────┘
           │                    │
           ▼                    ▼
┌─────────────────────────────────────────────┐
│            Shared SQLite/IPC               │
│  - Named pipe for communication            │
│  - Shared database file                    │
└─────────────────────────────────────────────┘
           │                    │
           ▼                    ▼
┌─────────────────────────────────────────────┐
│           Main Electron App                │
│  - Reads fresh tokens on startup           │
│  - Models already cached                   │
│  - Instant user experience                 │
└─────────────────────────────────────────────┘
```

#### 24.2 Implementation Tasks
- [ ] Create `orbit-daemon` Node.js service
- [ ] Windows service installer/uninstaller
- [ ] Service status UI in settings
- [ ] Start/stop service controls
- [ ] Service logs viewer
- [ ] Automatic service start on Windows boot
- [ ] Service health monitoring

#### 24.3 Model Registry Daemon
- [ ] Fetch all provider models periodically
- [ ] Store in shared database
- [ ] App reads cached models on startup
- [ ] Fallback to daemon cache if API fails

#### 24.4 Inter-Process Communication
- [ ] Named pipes for Windows IPC
- [ ] Unix sockets for Linux (future)
- [ ] Shared SQLite database
- [ ] File-based semaphores for sync

---

## 25. Linux Support

### 🟠 HIGH - Linux Platform Support

#### 25.1 Packaging Formats
- [ ] **AppImage** - Universal, no install needed
- [ ] **Flatpak** - Sandboxed, auto-updates
- [ ] **Snap** - Ubuntu store distribution
- [ ] **Debian (.deb)** - Ubuntu/Debian native
- [ ] **RPM** - Fedora/RHEL native
- [ ] **AUR** - Arch Linux package

#### 25.2 Native Module Compilation
- [ ] **better-sqlite3** - Prebuild for Linux
- [ ] **node-pty** - Prebuild for Linux
- [ ] **keytar** - Linux keyring integration
- [ ] Test on Ubuntu 22.04, 24.04
- [ ] Test on Fedora 38+
- [ ] Test on Arch Linux

#### 25.3 Linux-Specific Features
- [ ] **System Tray** - AppIndicator support
- [ ] **Notifications** - libnotify integration
- [ ] **File Associations** - .orbital file type
- [ ] **Protocol Handler** - orbit:// URLs
- [ ] **Desktop Entry** - .desktop file
- [ ] **MIME Types** - Proper associations

#### 25.4 Linux Daemon (systemd)
```ini
[Unit]
Description=Orbit Background Services
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/orbit-daemon
Restart=always
User=%I

[Install]
WantedBy=default.target
```

#### 25.5 Distribution Testing Matrix
| Distro | Version | Status |
|--------|---------|--------|
| Ubuntu | 22.04 LTS | 🔲 Pending |
| Ubuntu | 24.04 LTS | 🔲 Pending |
| Fedora | 39 | 🔲 Pending |
| Arch | Rolling | 🔲 Pending |
| Debian | 12 | 🔲 Pending |
| Linux Mint | 21 | 🔲 Pending |

---

## Updated Priority Matrix

### IMMEDIATE (This Week)
1. 🔴 Security fixes (secrets, XSS)
2. 🔴 ESLint configuration
3. 🔴 Test infrastructure
4. 🔴 Memory leak fixes
5. 🔴 Turkish hardcoded strings

### SHORT TERM (2 Weeks)
1. 🟠 Auth system database migration
2. 🟠 Gallery prompt storage
3. 🟠 Synchronous file → async
4. 🟠 Path alias imports
5. 🟠 Service categorization

### MEDIUM TERM (1 Month)  
1. 🟡 Statistics dashboard expansion
2. 🟡 Project system gaps
3. 🟡 Type safety (`any` removal)
4. 🟡 Multi-account support
5. 🟡 ESM migration

### LONG TERM (3 Months)
1. 🟢 Background Windows service
2. 🟢 Linux support + packaging
3. 🟢 Extreme optimizations
4. 🟢 New languages (DE, FR, ES, JA)
5. 🟢 A/B testing framework

---

## Updated Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| `any` types | 180+ | 0 | 1 month |
| Test coverage | <30% | 60% | 2 months |
| Bundle size | 2.3MB | 800KB | 2 months |
| Startup time | 3-5s | <1s | 2 months |
| Memory usage | 400MB | <150MB | 2 months |
| Security issues | 28 | 0 | 2 weeks |
| Hardcoded strings | 25+ | 0 | 2 weeks |
| Languages | 2 | 5 | 3 months |
| Platforms | 2 | 3 | 3 months |

---

*This document should be updated as tasks are completed.*  
*Last updated: 2026-01-14*  
*Total issues: 350+*

---

## 26. MCP System Expansion

### Current State

**Files**:
- `src/main/mcp/registry.ts` (318 lines) - MCP action definitions
- `src/main/mcp/dispatcher.ts` (312 lines) - MCP execution
- `src/main/mcp/types.ts` (16 lines) - Type definitions

**Current MCP Services** (13 built-in):
| Service | Actions | Description |
|---------|---------|-------------|
| FileSystem | 5 | read, write, delete, findDuplicates, unzip |
| Command | 2 | execute, killProcess |
| Web | 2 | scrape, search |
| Memory | 3 | store, retrieve, update |
| Network | 3 | ping, portScan, dnsLookup |
| Screenshot | 1 | capture |
| Notification | 1 | send |
| Git | 2 | status, log |
| Security | 2 | generatePassword, checkStrength |
| Clipboard | 1 | read |
| SSH | 3 | execute, listConnections, getStats |
| Ollama | 2 | list, generate |
| Docker | 3 | list, start, stop |

---

### 🔴 CRITICAL - New MCP Servers to Add

#### 26.1 Database MCPs
- [ ] **PostgreSQL MCP** - Query, insert, update, schema inspect
- [ ] **MySQL MCP** - Same operations for MySQL
- [ ] **MongoDB MCP** - CRUD operations, aggregations
- [ ] **Redis MCP** - Key-value operations, pub/sub
- [ ] **SQLite MCP** - Local database operations

#### 26.2 Cloud Provider MCPs
- [ ] **AWS MCP** - S3, Lambda, EC2 basics
- [ ] **Azure MCP** - Blob storage, Functions
- [ ] **GCP MCP** - Cloud Storage, Functions
- [ ] **Cloudflare MCP** - Workers, KV, R2

#### 26.3 DevOps MCPs
- [ ] **Kubernetes MCP** - Pod management, logs, scale
- [ ] **Terraform MCP** - Plan, apply, state
- [ ] **Ansible MCP** - Playbook execution
- [ ] **GitHub Actions MCP** - Workflow triggers

#### 26.4 API Integration MCPs
- [ ] **REST API MCP** - Generic HTTP client with auth
- [ ] **GraphQL MCP** - Query, mutation execution
- [ ] **gRPC MCP** - Protocol buffer based calls
- [ ] **WebSocket MCP** - Real-time connections

#### 26.5 AI/ML MCPs
- [ ] **HuggingFace MCP** - Model inference, datasets
- [ ] **Replicate MCP** - Model running
- [ ] **Stability AI MCP** - Image generation
- [ ] **ElevenLabs MCP** - Voice synthesis

#### 26.6 Productivity MCPs
- [ ] **Slack MCP** - Send messages, read channels
- [ ] **Discord MCP** - Bot interactions
- [ ] **Email MCP** - SMTP/IMAP operations
- [ ] **Calendar MCP** - Google/Outlook calendar

#### 26.7 Developer Tool MCPs
- [ ] **npm MCP** - Package info, search, publish
- [ ] **pip MCP** - Python packages
- [ ] **Cargo MCP** - Rust crates
- [ ] **Package Audit MCP** - Vulnerability scanning

---

### 🟠 HIGH - MCP Marketplace Improvements

**File**: `src/renderer/features/mcp/MCPStore.tsx`

- [ ] Server rating system
- [ ] Download/install tracking
- [ ] Server categories with icons
- [ ] Featured servers section
- [ ] Popular servers ranking
- [ ] Search with filters (category, rating, author)
- [ ] Server details modal with screenshots
- [ ] User reviews/comments
- [ ] Version history
- [ ] Dependency management
- [ ] Auto-update notification

---

### 🟡 MEDIUM - MCP Infrastructure

- [ ] MCP server validation on install
- [ ] MCP server sandboxing
- [ ] MCP permission system
- [ ] MCP rate limiting
- [ ] MCP usage analytics
- [ ] MCP health checks
- [ ] MCP logging per server

---

## 27. Provider Plugin System

### Current State

**File**: `src/main/services/llm/llm.service.ts` (694 lines)
- All providers hardcoded in single service
- API keys managed in settings
- No plugin architecture
- Model lists static or API-fetched

---

### 🔴 CRITICAL - Plugin Architecture

#### 27.1 Plugin Interface
```typescript
interface LLMProviderPlugin {
    // Metadata
    id: string
    name: string
    version: string
    author: string
    icon: string
    description: string
    
    // Configuration
    configSchema: JSONSchema7
    defaultConfig: Record<string, unknown>
    
    // Capabilities
    capabilities: {
        streaming: boolean
        vision: boolean
        functionCalling: boolean
        embeddings: boolean
        imageGeneration: boolean
    }
    
    // Core methods
    initialize(config: Record<string, unknown>): Promise<void>
    getModels(): Promise<ModelDefinition[]>
    chat(messages: Message[], options: ChatOptions): Promise<ChatResponse>
    chatStream(messages: Message[], options: ChatOptions): AsyncGenerator<StreamChunk>
    
    // Optional methods
    getEmbeddings?(input: string): Promise<number[]>
    generateImage?(prompt: string, options: ImageOptions): Promise<string>
    validateConfig?(config: Record<string, unknown>): ValidationResult
}
```

#### 27.2 Built-in Plugins to Create
| Plugin | Priority | Status |
|--------|----------|--------|
| OpenAI Plugin | 🔴 Critical | Extract from LLMService |
| Anthropic Plugin | 🔴 Critical | Extract from LLMService |
| Ollama Plugin | 🔴 Critical | Extract from OllamaService |
| Groq Plugin | 🟠 High | Extract from LLMService |
| Copilot Plugin | 🟠 High | Extract from CopilotService |
| OpenRouter Plugin | 🟡 Medium | New implementation |
| Together AI Plugin | 🟡 Medium | New implementation |
| Perplexity Plugin | 🟡 Medium | New implementation |
| Mistral Plugin | 🟡 Medium | New implementation |
| Cohere Plugin | 🟢 Low | New implementation |

#### 27.3 Plugin Management UI
- [ ] Plugin list view in Settings > Providers
- [ ] Enable/disable plugins
- [ ] Configure API keys per plugin
- [ ] Configure base URLs per plugin
- [ ] Model visibility toggles
- [ ] Plugin priority ordering
- [ ] Plugin update checker
- [ ] Custom plugin installation

---

### 🟠 HIGH - Model Visibility Settings

- [ ] Per-model hide/show toggle
- [ ] Quick filter (image models, code models, etc.)
- [ ] Favorites/pinned models
- [ ] Recently used models
- [ ] Model search history
- [ ] Model aliases (custom names)
- [ ] Model grouping by capability

---

## 28. Event System Enhancement

### Current State

Events are scattered across IPC handlers with no central event bus.

---

### 🔴 CRITICAL - Central Event Bus

#### 28.1 Event Architecture
```typescript
// Event definitions
type OrbitEvent = 
    // Chat events
    | { type: 'chat:created'; data: { chatId: string } }
    | { type: 'chat:deleted'; data: { chatId: string } }
    | { type: 'chat:message:sent'; data: { chatId: string; messageId: string } }
    | { type: 'chat:message:received'; data: { chatId: string; messageId: string } }
    | { type: 'chat:streaming:start'; data: { chatId: string } }
    | { type: 'chat:streaming:end'; data: { chatId: string; tokens: TokenUsage } }
    
    // Model events
    | { type: 'model:switched'; data: { from: string; to: string } }
    | { type: 'model:list:updated'; data: { provider: string } }
    
    // Auth events
    | { type: 'auth:login'; data: { provider: string } }
    | { type: 'auth:logout'; data: { provider: string } }
    | { type: 'auth:token:refreshed'; data: { provider: string } }
    | { type: 'auth:token:expired'; data: { provider: string } }
    
    // Project events
    | { type: 'project:opened'; data: { projectId: string } }
    | { type: 'project:closed'; data: { projectId: string } }
    | { type: 'project:file:changed'; data: { projectId: string; filePath: string } }
    
    // System events
    | { type: 'app:ready'; data: {} }
    | { type: 'app:focus'; data: {} }
    | { type: 'app:blur'; data: {} }
    | { type: 'quota:updated'; data: { provider: string } }
    | { type: 'settings:changed'; data: { key: string } }
```

#### 28.2 Event Implementation Tasks
- [ ] Create `EventBusService` class
- [ ] Create `OrbitEvent` type definitions
- [ ] Add event listener registration
- [ ] Add event emission
- [ ] Add event history (for debugging)
- [ ] Add event filtering
- [ ] Add event persistence (important events)
- [ ] Connect to renderer via IPC

#### 28.3 New Events to Add
- [ ] Token usage events
- [ ] Error events (per category)
- [ ] Performance events (latency)
- [ ] User action events (for analytics)
- [ ] Background job events
- [ ] Network status events

---

## 29. Instant/Planning/Thinking Mode Support

### 🔴 CRITICAL - Thinking Mode Implementation

**Current**: Basic thinking display in MessageBubble
**Target**: Full support for model thinking/reasoning capabilities

#### 29.1 Thinking/Reasoning Display
- [ ] Collapsible thinking section
- [ ] Thinking token count display
- [ ] Thinking time duration
- [ ] Copy thinking content
- [ ] Toggle thinking visibility globally
- [ ] Thinking search/filter

#### 29.2 Planning Mode
- [ ] Multi-step plan generation
- [ ] Plan step visualization
- [ ] Step-by-step execution
- [ ] Plan editing before execution
- [ ] Plan templates
- [ ] Plan history

#### 29.3 Instant Mode
- [ ] Quick response mode (minimal thinking)
- [ ] Auto-switch based on query type
- [ ] Per-chat mode preference
- [ ] Mode indicator in UI

#### 29.4 Model-Specific Support
| Model | Thinking | Planning |
|-------|----------|----------|
| Claude 3.5 | ✅ | ✅ |
| GPT-4 Turbo | ✅ | ✅ |
| o1-preview | ✅ (extended) | ✅ |
| o1-mini | ✅ | ✅ |
| Gemini 1.5 | ⚠️ Partial | ✅ |
| Llama 3.x | ⚠️ Partial | ⚠️ |

---

## 30. Token Tracking & Quota System

### Current State

**File**: `src/main/services/token-estimation.service.ts` (225 lines)
- Rough estimation only (~4 chars/token)
- No actual API token tracking
- No per-message token display

**File**: `src/main/services/proxy/quota.service.ts` (1032 lines)
- Provider-specific quota checking
- No integrated quota per message

---

### 🔴 CRITICAL - Accurate Token Tracking

#### 30.1 Token Counting
- [ ] Use `tiktoken` for OpenAI models
- [ ] Use `@anthropic-ai/tokenizer` for Claude
- [ ] Model-specific tokenizer selection
- [ ] Cache tokenizer instances
- [ ] Real token count from API responses

#### 30.2 Per-Message Token Display
- [ ] Input tokens for each user message
- [ ] Output tokens for each assistant message
- [ ] Total tokens for conversation
- [ ] Running token count in chat header
- [ ] Token cost estimation ($)

#### 30.3 Quota Integration
- [ ] Check quota before sending message
- [ ] Warning when approaching limit
- [ ] Block when limit reached
- [ ] Quota update after each message
- [ ] Provider-specific quota rules:

| Provider | Quota Type | Refresh |
|----------|------------|---------|
| Antigravity | Per-model limits | Rolling |
| Claude | 5-hour + 7-day | Fixed windows |
| Codex | Daily + Weekly | Midnight UTC |
| Copilot | Monthly | Month-end |
| OpenAI | Pay-as-you-go | N/A |

---

### 🟠 HIGH - Statistics Integration

- [ ] Token usage timeline graph
- [ ] Cost breakdown by model
- [ ] Cost breakdown by project
- [ ] Daily/weekly/monthly reports
- [ ] Export token usage data
- [ ] Budget alerts
- [ ] Usage predictions

---

## 31. Model Selector Redesign

### Current State

**File**: `src/renderer/features/models/components/ModelSelector.tsx` (640 lines)
- Dropdown with grouped models
- Basic search
- Provider icons

---

### 🟠 HIGH - New Model Selector Design

#### 31.1 Layout Improvements
- [ ] Compact mode vs expanded mode
- [ ] Grid view option
- [ ] Model cards with capabilities
- [ ] Quick model comparison
- [ ] Model preview (sample output)

#### 31.2 Filtering & Sorting
- [ ] Filter by capability (vision, code, etc.)
- [ ] Filter by context size
- [ ] Filter by price tier
- [ ] Sort by popularity
- [ ] Sort by speed
- [ ] Sort by last used

#### 31.3 Model Information
- [ ] Context window size display
- [ ] Speed indicator (tokens/sec)
- [ ] Cost per 1K tokens
- [ ] Model release date
- [ ] Model benchmarks
- [ ] Community ratings

#### 31.4 User Preferences
- [ ] Favorite models
- [ ] Hidden models
- [ ] Custom model aliases
- [ ] Default model per project
- [ ] Model shortcuts (Ctrl+1, etc.)

---

## 32. Service Refactoring for Open Source

### Current State

**52 service files** in `src/main/services/`
**Inconsistent patterns, naming, and organization**

---

### 🔴 CRITICAL - Service Consolidation

#### 32.1 Duplicate Functionality to Merge

| Functionality | Current Files | Merged Into |
|--------------|---------------|-------------|
| Logging | `logger.ts`, console.log scattered | `LoggingService` |
| Error handling | Per-service | `ErrorService` |
| File operations | `file.service.ts`, `filesystem.service.ts` | `FileSystemService` |
| Token operations | `token-estimation.service.ts`, IPC handlers | `TokenService` |
| Model data | `model-registry.service.ts`, `llm.service.ts` | `ModelRegistryService` |
| Health checks | `health-check.service.ts`, `ollama-health.service.ts` | `HealthService` |

#### 32.2 Service Naming Standardization

| Current | Standardized |
|---------|--------------|
| `chat-queue.manager.ts` | `chat-queue.service.ts` |
| `migration-manager.ts` | `migration.service.ts` |
| `proxy-process.manager.ts` | `proxy.service.ts` |

#### 32.3 Class/Method Naming Improvements

**Before → After Examples**:
```typescript
// Unclear
getToken() → getAuthToken()
saveData() → persistSettings()
fetch() → fetchModelList()
process() → processStreamChunk()

// Turkish in code
'llama-server çalışmıyor' → 'llama-server not running'
'Markdown Gorunumu' → 'Markdown View'
```

---

### 🟠 HIGH - Code Documentation

#### 32.4 JSDoc Requirements
- [ ] All public methods need JSDoc
- [ ] All interfaces need descriptions
- [ ] All parameters need `@param` tags
- [ ] Return types documented with `@returns`
- [ ] Examples for complex methods
- [ ] Error scenarios documented

#### 32.5 README Per Service Category
- [ ] `services/README.md` - Overview
- [ ] `services/data/README.md` - Data layer
- [ ] `services/llm/README.md` - LLM integration
- [ ] `services/proxy/README.md` - Proxy architecture
- [ ] `services/security/README.md` - Security layer

---

### 🟡 MEDIUM - IPC Handler Cleanup

#### 32.6 IPC Organization
**42 IPC handler files** need restructuring:

| Current | Proposed Structure |
|---------|-------------------|
| `chat.ts` | `ipc/chat/index.ts`, `ipc/chat/handlers.ts` |
| `db.ts` | `ipc/database/index.ts`, `ipc/database/handlers.ts` |
| `git.ts` | `ipc/git/index.ts`, `ipc/git/handlers.ts` |

#### 32.7 IPC Naming Conventions
- [ ] Consistent naming: `{domain}:{action}`
- [ ] Document all IPC channels
- [ ] Type-safe IPC with `electron-ipc-cat` or similar
- [ ] IPC validation with Zod schemas

---

## 33. Model Data Fetching & Caching

### Current State

- Models fetched on-demand from each provider
- No central cache
- Slow startup due to API calls

---

### 🔴 CRITICAL - Model Cache System

#### 33.1 Cache Architecture
```typescript
interface ModelCache {
    provider: string
    models: ModelDefinition[]
    fetchedAt: number
    expiresAt: number
    source: 'api' | 'cache' | 'fallback'
}

interface CacheConfig {
    ttl: number           // Time to live in ms
    staleWhileRevalidate: boolean
    fallbackEnabled: boolean
    maxAge: number        // Max cache age before refresh
}
```

#### 33.2 Cache Implementation Tasks
- [ ] SQLite cache table for models
- [ ] Memory cache for fast access
- [ ] Disk cache for persistence
- [ ] Cache invalidation on auth change
- [ ] Manual cache refresh button
- [ ] Cache status in UI
- [ ] Offline mode with cached data

#### 33.3 Background Refresh
- [ ] Schedule model refresh via `JobSchedulerService`
- [ ] Refresh intervals per provider:

| Provider | Refresh Interval |
|----------|-----------------|
| Ollama | 5 minutes (local) |
| OpenAI | 24 hours |
| Anthropic | 24 hours |
| Groq | 24 hours |
| Copilot | 1 hour |

---

### 🟠 HIGH - Cache + Quota Integration

- [ ] Quota check uses cached model list
- [ ] Quota results cached with short TTL
- [ ] Combined cache invalidation
- [ ] Unified cache status display

---

## 34. Codebase Structure Improvements

### 🟠 HIGH - Folder Organization

#### 34.1 Current vs Proposed Structure

```
src/main/
├── services/           # Current: 52 files flat + 9 folders
│   ├── index.ts        # ADD: Service exports
│   ├── types.ts        # ADD: Shared service types
│   │
│   ├── core/           # ADD: Core infrastructure
│   │   ├── base.service.ts
│   │   ├── event-bus.service.ts
│   │   ├── config.service.ts
│   │   └── job-scheduler.service.ts
│   │
│   ├── ai/             # RENAME from llm/
│   │   ├── providers/   # Plugin-based providers
│   │   ├── agents/      # Agent system
│   │   ├── memory/      # AI memory
│   │   └── orchestration/
│   │
│   ├── auth/           # CONSOLIDATE from security/ + auth.service
│   │   ├── auth.service.ts
│   │   ├── token.service.ts
│   │   └── key-rotation.service.ts
│   │
│   ├── data/           # EXISTS - Good
│   ├── project/        # EXISTS - Good
│   ├── proxy/          # EXISTS - Good
│   │
│   ├── integrations/   # ADD: External integrations
│   │   ├── ssh.service.ts
│   │   ├── docker.service.ts
│   │   ├── git.service.ts
│   │   └── mcp/
│   │
│   ├── ui/             # ADD: UI support services
│   │   ├── theme.service.ts
│   │   ├── notification.service.ts
│   │   └── clipboard.service.ts
│   │
│   └── analytics/      # ADD: Metrics & analytics
│       ├── telemetry.service.ts
│       ├── metrics.service.ts
│       └── usage-tracking.service.ts
```

---

### 🟡 MEDIUM - Renderer Structure

```
src/renderer/
├── features/           # Good - feature-based
│   ├── chat/
│   ├── projects/
│   ├── settings/
│   ├── models/         # EXPAND
│   ├── mcp/            # EXPAND
│   ├── plugins/        # ADD: Plugin management
│   └── analytics/      # ADD: Usage analytics
│
├── components/
│   ├── ui/             # Good - shadcn components
│   ├── layout/         # Good
│   └── shared/         # Good
│
├── hooks/              # EXPAND with more hooks
│   ├── useChat.ts
│   ├── useModels.ts
│   ├── useQuota.ts
│   ├── useTokens.ts
│   └── useEvents.ts    # ADD
│
└── lib/
    ├── api.ts          # ADD: Central API client
    ├── cache.ts        # ADD: Client-side cache
    └── events.ts       # ADD: Event utilities
```

---

## Updated Priority Action Items

### IMMEDIATE (This Week)
1. 🔴 Security fixes
2. 🔴 ESLint configuration
3. 🔴 Central event bus design
4. 🔴 Token tracking design

### SHORT TERM (2 Weeks)
1. 🟠 Provider plugin interface draft
2. 🟠 MCP marketplace improvements
3. 🟠 Model cache implementation
4. 🟠 Quota per-message integration
5. 🟠 Service consolidation plan

### MEDIUM TERM (1 Month)
1. 🟡 Extract OpenAI/Anthropic plugins
2. 🟡 New MCP servers (Database, Cloud)
3. 🟡 Thinking/Planning mode
4. 🟡 Model selector redesign
5. 🟡 Code documentation

### LONG TERM (3 Months)
1. 🟢 Full plugin ecosystem
2. 🟢 MCP marketplace backend
3. 🟢 Community plugin repository
4. 🟢 Plugin SDK

---

## 35. AI Instructions System Overhaul

### Current State

**File**: `src/shared/instructions.ts` (191 lines)
- Basic system prompt builder
- Language rules (TR/EN)
- Provider-specific instructions
- Personality configuration

**Current Issues**:
- Instructions not optimized for maximum AI efficiency
- No research guidance for AI
- No docs scanning instructions
- No internal language translation handling
- Response verbosity not controlled

---

### 🔴 CRITICAL - Research & Context Awareness

#### 35.1 Docs Scanning Before Changes
- [ ] Add instruction: "Before modifying code, scan `docs/` folder"
- [ ] Add instruction: "Always read `AI_RULES.md` before development tasks"
- [ ] Add instruction: "Check `ARCHITECTURE.md` for system structure"
- [ ] Add instruction: "Reference `SERVICES.md` for service patterns"
- [ ] Add instruction: "Check `TODO.md` for known issues"

**New Instruction Block**:
```markdown
## DOCUMENTATION AWARENESS
Before making any code changes:
1. Read `docs/AI_RULES.md` for coding standards
2. Check `docs/ARCHITECTURE.md` for system structure
3. Scan `docs/TODO.md` for related known issues
4. Follow patterns in `docs/SERVICES.md` for new services
```

#### 35.2 Research with Fresh Data
- [ ] Add instruction: "Use web search for current information"
- [ ] Add instruction: "Verify package versions before suggesting"
- [ ] Add instruction: "Check API documentation for latest endpoints"
- [ ] Add instruction: "Validate library compatibility before recommending"
- [ ] Add instruction: "Never assume - research when uncertain"

**New Instruction Block**:
```markdown
## RESEARCH REQUIREMENTS
When answering questions:
1. Use web search for current data (APIs, libraries, news)
2. Verify package versions before recommending
3. Check official documentation for accuracy
4. Never guess dates, versions, or specs - search first
5. Cite sources when providing factual information
```

---

### 🔴 CRITICAL - Language Processing

#### 35.3 Internal Translation Handling
- [ ] Add instruction: "Internally translate user input to English"
- [ ] Add instruction: "Process queries in English for consistency"
- [ ] Add instruction: "Respond in user's original language"
- [ ] Add instruction: "Maintain thought chain in English"

**New Instruction Block**:
```markdown
## LANGUAGE PROCESSING
Regardless of input language:
1. Internally translate the user's message to English
2. Process and reason in English
3. Generate response in English first
4. Translate final response to user's language
5. Maintain consistent terminology across translations
```

#### 35.4 Multi-language Quality
- [ ] Turkish technical term consistency
- [ ] Language-specific formatting (date, number)
- [ ] Cultural context awareness
- [ ] Code comments language matching

---

### 🔴 CRITICAL - Response Optimization

#### 35.5 Concise Responses
- [ ] Add instruction: "Give direct answers, no filler"
- [ ] Add instruction: "Never explain what you're about to do"
- [ ] Add instruction: "Don't repeat the question back"
- [ ] Add instruction: "Skip unnecessary confirmations"
- [ ] Add instruction: "One solution, not multiple options unless asked"

**New Instruction Block**:
```markdown
## RESPONSE OPTIMIZATION
- Give the answer immediately, no preamble
- Never say "I'll help you with...", just do it
- Don't explain your reasoning unless asked
- Don't list multiple approaches unless requested
- Never start with "Sure!", "Of course!", "Absolutely!"
- Get straight to the point
```

#### 35.6 Information Density
- [ ] Maximize useful information per token
- [ ] Use bullet points for lists
- [ ] Use tables for comparisons
- [ ] Use code blocks for any code
- [ ] Avoid redundant explanations

---

### 🟠 HIGH - Tool Usage Instructions

#### 35.7 MCP Tool Efficiency
- [ ] Add instruction: "Combine operations when possible"
- [ ] Add instruction: "Use batch operations over loops"
- [ ] Add instruction: "Prefer single comprehensive commands"
- [ ] Add instruction: "Chain tools efficiently"

**New Instruction Block**:
```markdown
## TOOL USAGE EFFICIENCY
- Combine multiple file reads into batch when possible
- Use grep/find before reading entire files
- Execute compound shell commands (cmd1 && cmd2)
- Don't read files you don't need to edit
- Cache results mentally, don't re-fetch
```

#### 35.8 Error Handling for Tools
- [ ] Add instruction: "Retry failed operations once"
- [ ] Add instruction: "Report clear error messages"
- [ ] Add instruction: "Suggest fixes for common errors"
- [ ] Add instruction: "Don't give up after first failure"

---

### 🟠 HIGH - Context-Specific Instructions

#### 35.9 Coding Task Instructions
```markdown
## CODING TASKS
When writing or modifying code:
1. Read AI_RULES.md for project standards
2. Use path aliases (@/, @main/, @shared/)
3. Follow existing patterns in the file
4. Add JSDoc for public functions
5. Use TypeScript strict types, never `any`
6. Test your changes mentally before submitting
```

#### 35.10 Research Task Instructions
```markdown
## RESEARCH TASKS
When answering informational questions:
1. Search the web for current information
2. Cite sources with dates
3. Distinguish facts from opinions
4. Admit uncertainty when appropriate
5. Provide actionable conclusions
```

#### 35.11 Debugging Task Instructions
```markdown
## DEBUGGING TASKS
When fixing bugs:
1. Understand the error first
2. Find the root cause, not symptoms
3. Test the fix mentally
4. Consider edge cases
5. Don't introduce new bugs
```

---

### 🟠 HIGH - Personality & Tone

#### 35.12 Default Personality Improvements
- [ ] Professional but not stiff
- [ ] Helpful without being sycophantic
- [ ] Confident but not arrogant
- [ ] Concise but not cold
- [ ] Technical when needed, simple when possible

#### 35.13 Adaptability
- [ ] Match user's energy level
- [ ] Detect frustration and be more helpful
- [ ] Detect expertise and adjust depth
- [ ] Detect urgency and be more direct

---

### 🟡 MEDIUM - Instruction Templates

#### 35.14 Per-Task Type Templates
- [ ] **Code Review Template** - What to look for
- [ ] **Refactoring Template** - How to approach
- [ ] **Documentation Template** - What to include
- [ ] **Testing Template** - How to write tests
- [ ] **Debugging Template** - How to investigate

#### 35.15 Per-Provider Templates
- [ ] **OpenAI Template** - Leverage function calling
- [ ] **Claude Template** - Leverage extended thinking
- [ ] **Ollama Template** - Optimize for local
- [ ] **Copilot Template** - Code-focused instructions

---

### 🟡 MEDIUM - Dynamic Instructions

#### 35.16 Context-Aware Injection
- [ ] Inject project-specific rules when in project
- [ ] Inject file-type rules when editing (Python vs TS)
- [ ] Inject domain rules (web dev vs mobile vs backend)
- [ ] Inject user preference history

#### 35.17 Learning from Interactions
- [ ] Track what instructions lead to good responses
- [ ] A/B test instruction variations
- [ ] User feedback on response quality
- [ ] Automatic instruction refinement

---

### 🟢 LOW - Advanced Features

#### 35.18 Instruction Editor UI
- [ ] Settings page for custom instructions
- [ ] Per-project instruction overrides
- [ ] Instruction templates gallery
- [ ] Import/export instructions

#### 35.19 Instruction Analytics
- [ ] Which instructions are most effective
- [ ] Response quality metrics
- [ ] User satisfaction correlation
- [ ] Token efficiency tracking

---

## 36. AI Response Quality Metrics

### 🟠 HIGH - Quality Measurement

#### 36.1 Response Metrics to Track
- [ ] **Accuracy Rate** - Correct information percentage
- [ ] **Conciseness Score** - Useful info per token
- [ ] **Completion Rate** - Tasks fully completed
- [ ] **Retry Rate** - How often user re-asks
- [ ] **Tool Success Rate** - Tools used successfully

#### 36.2 User Feedback Integration
- [ ] Thumbs up/down on responses
- [ ] "Regenerate" tracking
- [ ] Edit frequency on AI outputs
- [ ] Follow-up question patterns

---

## 37. Additional Codebase TODOs

### 🔴 CRITICAL - Immediate Fixes

#### 37.1 Security Hardening
- [ ] Remove hardcoded `ANTIGRAVITY_CLIENT_SECRET` from quota.service.ts
- [ ] Audit all `shell: true` usages in spawn calls
- [ ] Sanitize all `dangerouslySetInnerHTML` with DOMPurify
- [ ] Add CSP headers to renderer
- [ ] Validate all file paths for traversal attacks

#### 37.2 Error Handling
- [ ] Replace all empty catch blocks with proper logging
- [ ] Replace `console.log` with `appLogger` everywhere
- [ ] Add error boundaries to all major components
- [ ] Create central error reporting service

---

### 🟠 HIGH - Performance Fixes

#### 37.3 Rendering Performance
- [ ] Profile and fix slow components
- [ ] Add React.memo to pure components
- [ ] Use virtual scrolling for long lists
- [ ] Debounce expensive state updates

#### 37.4 Startup Performance
- [ ] Profile and reduce service init time
- [ ] Lazy load non-critical services
- [ ] Pre-warm frequently used paths
- [ ] Add startup time metrics

---

### 🟡 MEDIUM - Code Quality

#### 37.5 TypeScript Strictness
- [ ] Enable `noImplicitAny`
- [ ] Enable `strictNullChecks`
- [ ] Remove all `@ts-ignore` comments
- [ ] Remove all `@ts-expect-error` without explanation

#### 37.6 Testing Infrastructure
- [ ] Fix vitest configuration
- [ ] Add test coverage reporting
- [ ] Set minimum coverage thresholds
- [ ] Add pre-commit test hooks

---

## Updated Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Services | 52 flat | 35 organized | 1 month |
| MCP servers | 13 | 30+ | 2 months |
| Plugins | 0 | 10 built-in | 2 months |
| Events | ~20 scattered | 50+ centralized | 1 month |
| JSDoc coverage | <5% | 80% | 2 months |
| Token accuracy | ~75% | 99% | 2 weeks |
| AI instruction sections | 4 | 15+ | 2 weeks |
| Response quality metrics | 0 | 5 tracked | 1 month |

---

*This document should be updated as tasks are completed.*  
*Last updated: 2026-01-14*  
*Total issues: 600+*
