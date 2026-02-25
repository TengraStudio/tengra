# Security and Authentication

Security is built into every layer of Tengra. We focus on protecting user credentials, securing local data storage, and hardening the communication between our various processes.

## Token Management and Synchronization

Tengra utilizes a stateless proxy architecture. This design ensures that sensitive credentials are never stored in plain text on the filesystem and are only held in memory or within an encrypted database.

### Bidirectional API Synchronization
Communication between the Electron main process and our microservices (Go and Rust) occurs over a secure, localized HTTP interface.
- **On-Demand Pull**: The Go proxy retrieves decrypted tokens from Tengra's internal `AuthAPIService` only when needed for an outgoing request. This request is authenticated using a system-generated secret key.
- **Immediate Push Persistence**: When a microservice performs a background token refresh, the updated credentials are immediately pushed back to the Main process via a POST request. The Main process then encrypts and persists the new token to the database.
- **Zero Disk Footprint**: We have eliminated the use of temporary JSON files for credential storage. All legacy files are purged during the application's initialization phase.

## Encryption Standards

We employ a multi-tiered approach to data protection at rest, catering to both modern security requirements and legacy compatibility.

### Tengra Custom V1 (AES-256-GCM)
This is our primary encryption tier. It uses the AES-256-GCM algorithm, providing both confidentiality and integrity.
- **Key Generation**: A master key is generated upon the first run of the application using PBKDF2 with a high iteration count.
- **Storage**: The master key is stored securely in the local configuration directory, and used to encrypt all high-value tokens.
- **Validation**: Every decryption attempt includes a tag validation to ensure the data has not been tampered with.

### Legacy Tier (Platform Integration)
For compatibility and as an additional layer, we integrate with platform-specific secure storage (Electron's `safeStorage`). This utilizes DPAPI on Windows and the Keychain on macOS.

## Hardening Inter-Process Communication (IPC)

The IPC bridge is the only gateway through which the UI can interact with the system. We harden this interface using several techniques:
- **Context Isolation**: The Renderer process has no direct access to Node.js APIs. It can only communicate through a strictly defined preload script.
- **Method Whitelisting**: Only a specific subset of service methods are exposed to the UI, minimizing the attack surface.
- **Payload Validation**: All data passing through the IPC bridge is validated to prevent injection attacks or malformed data from affecting the system state.

## Content Security and Sanitization

AI-generated content and markdown are inherently untrusted.
- **DOMPurify**: All rendered content is passed through DOMPurify to strip out malicious scripts or dangerous HTML attributes.
- **Path Validation**: Any tool that interacts with the filesystem (such as the SSH or File service) performs strict validation to prevent path traversal outside of the user's workspace.

## Core Security Principles

1. **Least Privilege**: Services are designed to only have access to the data and tools necessary for their specific functionality.
2. **Stateless Ephemeral Data**: We avoid writing sensitive session data to disk whenever possible.
3. **Internal Auditing**: Security-critical operations, such as authentication attempts and encryption upgrades, are recorded in an internal audit log for diagnostic purposes.

## Vulnerability Reporting

Private disclosure is required for potential vulnerabilities.

1. Do not open public issues for exploitable findings.
2. Share impacted version, reproduction steps, impact analysis, and proof-of-concept.
3. Include suggested mitigation when possible.

For reporting process details and response SLA, see `docs/SECURITY_POLICY.md`.


