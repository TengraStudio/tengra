# Security Roadmap

## 🔴 CRITICAL - Vulnerabilities

### 1.1 Hardcoded Secrets
- [x] `token.service.ts`: Client secret removed
- [x] `quota.service.ts`: Client Secret removed
- [ ] Audit remaining codebase for hardcoded keys

### 1.2 Injection Risks
- [x] **XSS**: Sanitized `dangerouslySetInnerHTML` with DOMPurify
- [ ] **Shell Injection**: Audit `shell: true` usage
    - `src/main/services/llm/local-ai.service.ts`
    - `src/main/mcp/dispatcher.ts`
    - `src/main/ipc/window.ts`

### 1.3 Path Traversal
- [ ] Audit all file system access for `../` blocking
- [ ] Verify `SSHService` path validation

### 1.4 JSON Safety
- [x] Wrap `JSON.parse` in try-catch blocks (Phase 4/5)
- [ ] Audit remaining 90+ instances

---

## 🟠 HIGH - Data Security

### 2.1 Auth Migration
- [ ] Migrate auth tokens from JSON files to Encrypted Database
- [ ] Implement Session Expiry checks

### 2.2 Sensitive Data
- [ ] Ensure passwords in `SSHService` are encrypted at rest
- [ ] Audit logging for accidental credential leakage

---

## 🟡 MEDIUM - Access Control

### 3.1 IPC Security
- [ ] Add schema validation for all IPC payloads
- [ ] Add rate limiting to sensitive IPC channels
- [ ] Add permission checks for privileged actions

### 3.2 Tool Security
- [ ] Implement Forbidden Tools restrictions
- [ ] Implement Protected Paths enforcement

---

## 🟢 LOW - Hardening

- [ ] Add Content Security Policy (CSP) headers
- [ ] Enable context isolation for all windows (Verified default)
