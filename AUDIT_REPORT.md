# Security, Type Safety & i18n Audit Report
Generated: 2025-01-11

## 1. Security Issues

### 🔴 CRITICAL: Hardcoded OAuth Secrets
**Location:** `scripts/token-refresh-service.js:24-25`
```javascript
const ANTIGRAVITY_CLIENT_SECRET = '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';
```
**Issue:** OAuth client secret is hardcoded. Client IDs are public, but secrets should be in environment variables or secure storage.
**Recommendation:** Move to environment variables or secure configuration storage.

**Location:** `src/main/services/token-refresh.service.ts:13-14`
```typescript
const ANTIGRAVITY_CLIENT_SECRET = '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';
```
**Same issue in main service.**

### ⚠️ WARNING: Insecure WebSocket Connection
**Location:** `src/renderer/features/projects/components/ProjectWorkspace.tsx:113`
```typescript
const ws = new WebSocket('ws://localhost:3001')
```
**Issue:** Hardcoded WebSocket URL without validation. Could be vulnerable if port changes or service is compromised.
**Recommendation:** Add validation, use secure WebSocket (wss://) in production, or make configurable.

**Location:** `src/renderer/features/agent/AgentChatRoom.tsx:38`
```typescript
const socket = new WebSocket('ws://localhost:3001')
```
**Same issue.**

### ⚠️ WARNING: Insecure Content Security Policy
**Location:** Console warning indicates CSP is either missing or has "unsafe-eval" enabled.
**Recommendation:** Implement proper CSP headers.

### ⚠️ INFO: Hardcoded URLs
Multiple hardcoded API URLs found (GitHub, OpenAI, Anthropic, etc.). These are expected for API endpoints, but consider making configurable for testing/proxy scenarios.

---

## 2. Lint Errors
✅ **No lint errors found** - All files pass linting.

---

## 3. Type Safety Issues: `any` and `unknown` Usage

### Files with `any` type (14 files):
1. **src/main/services/token-refresh.service.ts** (3 instances)
   - Line 255, 338, 417: Error handlers using `any`

2. **src/renderer/features/chat/components/AgentCouncil.tsx** (1 instance)
   - Line 121: Commented out code with `any`

3. **src/main/startup/services.ts** (1 instance)
   - Line 90: `ollamaHealthService: any` - Should be properly typed

4. **src/renderer/features/projects/components/workspace/CouncilPanel.tsx** (1 instance)
   - Line 139: `activityLog.map((log: any)` - Should have proper LogEntry type

5. **src/main/ipc/project.integration.test.ts** (2 instances)
   - Test files - acceptable for mocks

6. **src/main/ipc/chat.integration.test.ts** (2 instances)
   - Test files - acceptable for mocks

7. **src/main/core/container.test.ts** (1 instance)
   - Test file - acceptable

8. **src/main/services/health-check.service.ts** (2 instances)
   - Line 202-203: Service types using `any` - Should be properly typed

9. **src/main/services/security/key-rotation.service.test.ts** (1 instance)
   - Test file - acceptable

10. **src/main/utils/ipc-wrapper.util.ts** (2 instances)
    - Line 23, 25: IPC handler args using `any[]` - Consider using generic types

11. **src/main/services/config.service.test.ts** (1 instance)
    - Test file - acceptable

12. **src/main/core/service-registry.ts** (4 instances)
    - Lines 37, 75, 76, 88: Service registry using `any` - Should use generics

13. **src/main/services/data/chat-event.service.test.ts** (2 instances)
    - Test file - acceptable

14. **src/main/services/data/chat-event.service.ts** (1 instance)
    - Line 90: `rebuildThreadState` returns `any[]` - Should be properly typed

### Files with `unknown` type (7 files):
1. **src/renderer/features/projects/components/ProjectWorkspace.tsx** (1 instance)
   - Line 153: Error handler using `unknown` - ✅ Good practice

2. **src/main/services/prompts/agent-prompts.ts** (1 instance)
   - Line 43: Args type using `unknown[]` - Could be more specific

3. **src/main/core/circuit-breaker.ts** (1 instance)
   - Line 54: Error handler using `unknown` - ✅ Good practice

4. **src/shared/utils/error.util.ts** (1 instance)
   - Line 32: Error handler using `unknown` - ✅ Good practice

5. **src/main/services/http.service.ts** (1 instance)
   - Line 66: Error handler using `unknown` - ✅ Good practice

6. **src/main/services/base.service.ts** (3 instances)
   - Lines 26, 30, 34: Log methods using `unknown[]` - ✅ Acceptable for logging

7. **src/main/services/data/database.service.test.ts** (6 instances)
   - Test file - acceptable

**Priority Fixes:**
- `src/main/startup/services.ts:90` - `ollamaHealthService: any`
- `src/main/services/health-check.service.ts:202-203` - Service types
- `src/main/core/service-registry.ts` - Use generics instead of `any`
- `src/main/services/data/chat-event.service.ts:90` - Return type should be specific
- `src/renderer/features/projects/components/workspace/CouncilPanel.tsx:139` - Activity log type

---

## 4. i18n Key Issues

### Missing Keys Analysis
Based on usage patterns in code, the following keys may be missing or need verification:

**Verified Present in Language Files:**
- ✅ All `common.*` keys exist
- ✅ All `projectDashboard.*` keys exist (including `totalSize`)
- ✅ All `statistics.*` keys exist
- ✅ All `accounts.*` keys exist
- ✅ All `sidebar.*` keys exist (including `newFolder`, `emptyFolder`, `pinned`)
- ✅ All `workspace.*` keys exist (including `totalSize`, `dangerZone`)

**Missing Translation Keys:**
- ❌ `sidebar.removeFromFolder` - **MISSING** in both `en.ts` and `tr.ts`
  - Used in `src/renderer/components/layout/Sidebar.tsx:513`
  - Currently has fallback: `|| 'Remove from folder'`
  
**Keys with Fallbacks (should verify if needed):**
- `projects.deleteWarning` - Has fallback `|| 'This action cannot be undone.'`
- `projects.changeLogo` - Has fallback `|| 'Change Logo'`
- `projects.description` - Has fallback `|| 'Description'`

**Note:** Most keys are present. The fallbacks in code are likely defensive programming, not missing keys.

---

## Summary

### Security Issues: 3
- 🔴 1 Critical: Hardcoded OAuth secrets
- ⚠️ 2 Warnings: Insecure WebSocket connections, CSP missing

### Lint Errors: 0
✅ Clean codebase

### Type Safety Issues: 21 `any` instances, 13 `unknown` instances
- High Priority: 5 files need proper typing
- Test Files: 6 files (acceptable)
- Low Priority: Error handlers using `any` (acceptable but could improve)

### i18n Issues: ~7 potentially missing keys
- Most keys are present with fallbacks
- Need to verify `projectDashboard.totalSize` in Turkish translation

---

## Recommendations

1. **Immediate Actions:**
   - Move OAuth secrets to environment variables or secure config
   - Add validation for WebSocket connections
   - Fix high-priority type safety issues

2. **Short-term:**
   - Implement proper CSP headers
   - Replace `any` types in service registry and health check
   - Verify and add missing i18n keys

3. **Long-term:**
   - Consider making API URLs configurable
   - Improve type safety across the codebase
   - Set up automated i18n key validation in CI/CD
