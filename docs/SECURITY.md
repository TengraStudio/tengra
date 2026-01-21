# Security & Authentication

Security is a foundational pillar of Orbit. We implement multiple layers of protection to ensure that user credentials, local data, and cross-process communications remain secure.

## 1. Token Management & Synchronization

Orbit uses a **Stateless Proxy Architecture**. Unlike legacy systems that write plain-text credentials to the disk, Orbit manages all sensitive tokens in memory or within its encrypted database.

### Bidirectional API Synchronization
As of v1.2.0, synchronization between the Electron app and the Go proxy happens exclusively over a local HTTP interface:
- **Pull Sync**: The Go proxy requests de-encrypted tokens from Orbit's `AuthAPIService` using a unique `Secret Key`.
- **Push Persistence**: When a microservice refreshes a token (e.g., Claude or Antigravity), it POSTS the update back to Orbit, which then persists it to the secure database.
- **Disk Security**: No JSON files containing tokens are written to the filesystem. Legacy `.json` credentials are automatically cleaned up on application startup.

## 2. Encryption Standards

Orbit employs a two-tier encryption strategy for data at rest.

### Orbit V1 (Custom AES-256-GCM)
- **Algorithm**: AES-256-GCM with a unique PBKDF2-derived master key.
- **Master Key**: Generated on first run and stored at `runtime/data/config/security.key`.
- **Prefix**: Tokens stored with this format are prefixed with `orbit:v1:`.

### Legacy Tier (Electron safeStorage)
- **Fallback**: Uses the operating system's native credential store (DPAPI on Windows, Keychain on macOS).
- **Prefix**: Tokens stored with this format are prefixed with `v1:`.

## 3. IPC (Inter-Process Communication) Hardening

The interface between the UI and the system is strictly controlled to prevent unauthorized access to local resources.

- **Non-Exposable APIs**: Only explicitly mapped methods are exposed via the `window.electron` bridge.
- **Command Sanitization**: All shell commands executed via IPC are sanitized to block injection sequences (e.g., backticks, subshells, newlines).
- **Preload Isolation**: The preload script operates in a separate context from the UI, preventing XSS attacks from accessing Node.js internals.

## 4. Content Security & Sanitization

- **XSS Protection**: All markdown and AI-generated content (including Mermaid diagrams) is sanitized using **DOMPurify** before rendering.
- **Path Traversal Protection**: File-related services (SSH, FileSystem) perform strict path validation to ensure operations are confined to authorized directories.

## 5. Security Principles

1. **Least Privilege**: Microservices are granted only the permissions required for their specific domain.
2. **Stateless Operations**: Local disk usage for sensitive ephemeral data is minimized.
3. **Auditability**: All security-critical events (login, refresh, failed auth) are logged to the internal audit log stored in the database.
