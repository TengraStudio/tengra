# Security Policy

## Supported Versions

Only the latest version of Tengra is supported for security updates. Please ensure you are running the most recent release.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Tengra seriously. If you believe you have found a security vulnerability, please report it to us responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please send an email to `security@tengra.studio` with the following information:

- A description of the vulnerability.
- Steps to reproduce the issue.
- Potential impact if exploited.
- Any suggested mitigations.

We will acknowledge your report within 48 hours and work with you to resolve the issue before making it public.

## Security Features in Tengra

Tengra implements several architectural security features:

- **Native Isolation**: Critical operations (database, proxy, process management) are handled in native Rust services.
- **Path Policies**: Filesystem access is restricted to user-defined workspaces and specific application directories.
- **Secret Management**: API keys and tokens are stored using system-level secure storage (via Electron's `safeStorage`) and passed securely to native sidecars.
- **MCP Sandboxing**: External plugins are executed in isolated processes.
