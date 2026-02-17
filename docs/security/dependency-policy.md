# Dependency Security Triage Policy

This document defines the policy for managing and triaging dependency vulnerabilities identified by `npm audit` or other security scanners.

## Triage Process

When a vulnerability is identified, developers must follow these steps in order of preference:

1.  **Patch**: Update the dependency to a version that includes a fix using `npm update` or by manually updating `package.json`.
2.  **Pin/Override**: If a transitive dependency is vulnerable, use the `overrides` field in `package.json` to force a safe version.
3.  **Exception**: If no fix is available and the risk is assessed as low (e.g., dev-dependency only, non-exploitable context), add the finding to `docs/security/audit-exceptions.json`.

## Risk Classification

-   **Critical/High**: Immediate attention required. Must be patched or mitigated before next production release.
-   **Moderate/Low**: Should be addressed in regular maintenance cycles.

## Adding Exceptions

Exceptions must be documented in `audit-exceptions.json` with the following mandatory fields:
- `package`: The name of the vulnerable package.
- `cve`: The CVE ID (if available).
- `reason`: Technical justification for why this is considered low risk.
- `expiry`: A tentative date to re-evaluate the exception.

> [!WARNING]
> Exceptions should only be used as a last resort. Always prefer patching.
