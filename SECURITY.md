# Security Policy & Authentication Guide

Security is built into every layer of Tengra. We focus on protecting user credentials, securing local data storage, and hardening communication between processes.

## 1. Security Principles

1.  **Least Privilege**: Services are designed to only have access to the data and tools necessary for their specific functionality.
2.  **Stateless Ephemeral Data**: We avoid writing sensitive session data to disk whenever possible. Raw decrypted credentials never touch disk.
3.  **Local-First Philosophy**: All data processing is done locally. No data is transmitted to cloud services without user consent.
4.  **Zero Suppression**: `@ts-ignore` and `eslint-disable` are NOT allowed. Fix the underlying issue.

---

## 2. Hardening Inter-Process Communication (IPC)

The IPC bridge is the only gateway for the UI. We harden this interface using several techniques:
- **Context Isolation**: Renderer has no direct access to Node.js APIs.
- **Payload Validation**: All data passing through the IPC bridge is validated using Zod schemas.
- **Sender Validation**: IPC messages are validated to come from the main application window only.

---

## 3. Encryption Standards

We employ a multi-tiered approach to data protection at rest.

### Tengra Custom V1 (AES-256-GCM)
Our primary encryption tier, providing both confidentiality and integrity.
- **Key Generation**: A master key is generated upon first run using PBKDF2.
- **Storage**: The master key is stored securely in the local configuration directory.
- **Validation**: Every decryption attempt includes tag validation.

### Legacy Tier (Platform Integration)
For compatibility, we integrate with platform-specific secure storage (Electron's `safeStorage`), utilizing DPAPI on Windows and the Keychain on macOS.

---

## 4. Vulnerability Reporting

Private disclosure is required for potential findings.

1.  Send report to project maintainers with:
    - Impacted version
    - Reproduction steps
    - Proof of concept
    - Suggested mitigation (if available)
2.  Do NOT open a public issue before triage.

### Triage SLA
- Initial acknowledgement: within 72 hours.
- Severity classification: within 7 days.
- Patch target for critical/high: 7-14 days.

---

## 5. Severity Model

- **Critical**: Remote code execution, auth bypass, credential exfiltration.
- **High**: Privilege escalation, sensitive data leakage.
- **Medium**: Constrained exploit requiring local access.
- **Low**: Hardening issue with limited practical impact.

---

For technical details on auth services, see the code in `src/main/services/security/`.
