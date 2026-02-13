# Security Policy

## Supported Versions

Security fixes are backported for:

- Current major release
- Previous minor release branch

## Vulnerability Reporting

Use private disclosure first.

1. Send report to project maintainers with:
   - Impacted version
   - Reproduction steps
   - Proof of concept (minimal)
   - Suggested mitigation (if available)
2. Do not open a public issue before triage.

## Triage SLA

- Initial acknowledgement: within 72 hours
- Severity classification: within 7 days
- Patch target:
  - Critical: 7 days
  - High: 14 days
  - Medium/Low: next planned release

## Severity Model

- Critical: remote code execution, auth bypass, credential exfiltration
- High: privilege escalation, sensitive data leakage
- Medium: constrained exploit requiring local access
- Low: hardening issue with limited practical impact

## Coordinated Disclosure

After fix is released:

1. Publish advisory summary.
2. Credit reporter (if requested).
3. Include CVE/reference ID when available.

## Hardening Baseline

1. Keep `contextIsolation` enabled and Node integration disabled in renderer.
2. Validate all IPC payloads and sanitize filesystem paths.
3. Encrypt credentials at rest and avoid plaintext logging.
4. Enforce dependency/audit checks in CI.
