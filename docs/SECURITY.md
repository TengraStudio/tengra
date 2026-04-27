# 🔐 TENGRA SECURITY PROTOCOLS

## 1. DATA PROTECTION
- **Persistence**: Application settings and chat history are stored locally in `%APPDATA%/Tengra`.
- **Encryption**: Sensitive data (Tokens/Keys) MUST be encrypted via `SecurityService` using AES-256 and platform-specific secure storage (Electron `safeStorage`).
- **Isolation**: No Node.js APIs in the renderer. Strict context isolation via preload bridge.

## 2. IPC SECURITY
- **Validation**: Every IPC handler MUST use Zod schemas for input validation.
- **Whitelist**: Only explicitly registered IPC channels are accessible via the bridge.

## 3. VULNERABILITY TRIAGE
- **Report**: Private disclosure required for all findings.
- **SLA**: Initial ack < 72h. High/Critical patch < 14 days.
- **Zero Tolerance**: No hardcoded secrets, no cleartext tokens in logs, no `any` types.

## 4. CRITICAL NOTICES
- **Production Only**: Do not use dev-only tokens in production builds.
- **Sanitization**: All AI/User inputs must be sanitized before rendering to prevent XSS.

"Security is not a feature, it's a foundation."
