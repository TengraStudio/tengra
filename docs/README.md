# Tengra Documentation

This directory is the project documentation hub. Start here when setting up the repository, reviewing architecture, preparing a release, or contributing changes.

Tengra is an unofficial client. It is not affiliated with GitHub, Microsoft, Google, Anthropic, OpenAI, NVIDIA, or their subsidiaries. Users and contributors are responsible for complying with each provider's terms.

## Recommended Reading Order

1. [Root README](../README.md): quick start and project summary.
2. [Contributing](./CONTRIBUTING.md): local setup, validation commands, and contribution rules.
3. [Project Structure](./PROJECT_STRUCTURE.md): where code lives and how modules are organized.
4. [Architecture](./ARCHITECTURE.md): process model, IPC, data, and native service boundaries.
5. [Managed Runtime](./MANAGED_RUNTIME.md): native binary lifecycle and first-run runtime checks.
6. [Security](./SECURITY.md): IPC hardening, credential storage, and reporting process.
7. [Release Checklist](./RELEASE_CHECKLIST.md): pre-release checks for public/open-source releases.

## Documentation Index

| Document | Use For | Status |
| --- | --- | --- |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Local setup, workflow, verification, pull requests | Current |
| [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) | Repository map and module ownership | Current |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture and process boundaries | Current |
| [MANAGED_RUNTIME.md](./MANAGED_RUNTIME.md) | Managed native runtime, repair flow, binary ownership | Current |
| [API.md](./API.md) | IPC and local REST API overview | Current |
| [SECURITY.md](./SECURITY.md) | Security model and vulnerability reporting | Current |
| [GUIDE.md](./GUIDE.md) | User-facing guide and troubleshooting | Current |
| [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) | Launch/release readiness checks | Current |
| [PERFORMANCE_CONTRACT.md](./PERFORMANCE_CONTRACT.md) | Startup and performance expectations | Reference |
| [SESSION_ENGINE.md](./SESSION_ENGINE.md) | Chat/session engine details | Reference |
| [STARTUP_ACTIVATION_MATRIX.md](./STARTUP_ACTIVATION_MATRIX.md) | Startup activation policy | Reference |
| [I18N_GUIDE.md](./I18N_GUIDE.md) | Localization workflow | Reference |
| [advanced-hardening.md](./advanced-hardening.md) | Extra hardening notes | Reference |
| [enforcement.md](./enforcement.md) | Enforcement policy notes | Reference |
| [prohibited-actions.md](./prohibited-actions.md) | Actions contributors/agents must avoid | Policy |
| [CRITICAL_NOTICE.md](./CRITICAL_NOTICE.md) | Provider affiliation notice | Policy |
| [TODO.md](./TODO.md) | Backlog and historical project notes | Working document |

## Agent and Governance Docs

The following files are primarily for AI-agent sessions and internal operating rules. They can be useful context, but they are not the fastest onboarding path for human contributors:

- [AGENTS.md](./AGENTS.md)
- [AI_RULES.md](./AI_RULES.md)
- [MASTER_COMMANDMENTS.md](./MASTER_COMMANDMENTS.md)
- [context.md](./context.md)
- [code-style-guide.md](./code-style-guide.md)

When a governance document conflicts with executable project checks, the checks in `package.json`, CI workflows, and the current source tree are authoritative.

## Common Commands

```bash
npm install
npm run dev
npm run type-check
npm test
npm run lint
npm run secrets:scan
npm run audit:deps:gate
npm run build
```

`npm run build` performs the Monaco asset copy, native Rust build/copy step, TypeScript check, and Vite builds. Local builds skip strict lint and bundle budget unless the relevant environment variables are set.

## Documentation Maintenance

- Keep root-level onboarding short; put technical detail in `docs/`.
- Update this index when adding or removing docs.
- Prefer concrete commands and paths over broad prose.
- Do not document old service names such as `cliproxy-embed`; the active native proxy is `tengra-proxy`.
- Do not add scratch notes under `docs/`. Use `scratch/` or an issue/PR draft for temporary work.
