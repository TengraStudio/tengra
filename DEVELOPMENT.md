# Tengra Development Guide

This document is the project development hub. Start here when setting up the repository, reviewing architecture, preparing a release, or contributing changes.

Tengra is an unofficial client. It is not affiliated with GitHub, Microsoft, Google, Anthropic, OpenAI, NVIDIA, or their subsidiaries. Users and contributors are responsible for complying with each provider's terms.

## Recommended Reading Order

1. [README.md](README.md): Quick start and project summary.
2. [CONTRIBUTING.md](CONTRIBUTING.md): Local setup, validation commands, and contribution rules.
3. [ARCHITECTURE.md](ARCHITECTURE.md): Process model, IPC, data, and native service boundaries.
4. [API.md](API.md): IPC and local REST API overview.
5. [TODO.md](TODO.md): Backlog and historical project notes.

## Documentation Index

| Document | Use For | Status |
| --- | --- | --- |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Local setup, workflow, verification, pull requests | Current |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture and process boundaries | Current |
| [API.md](API.md) | IPC and local REST API overview | Current |
| [AI_RULES.md](AI_RULES.md) | Rules for AI agents and automated assistants | Current |
| [code-style-guide.md](code-style-guide.md) | Frontend and Backend coding standards | Current |
| [advanced-hardening.md](advanced-hardening.md) | Extra hardening notes | Reference |
| [enforcement.md](enforcement.md) | Enforcement policy notes | Reference |
| [TODO.md](TODO.md) | Backlog and working documents | Working document |

## Common Commands

```bash
npm install
npm run dev
npm run type-check
npm test
npm run lint
npm run build
```

`npm run build` performs the Monaco asset copy, native Rust build/copy step, TypeScript check, and Vite builds.

## Documentation Maintenance

- Keep root-level onboarding short.
- Update this index when adding or removing docs.
- Prefer concrete commands and paths over broad prose.
- Do not document old service names; the active native proxy is `tengra-proxy`.
- Do not add scratch notes here. Use `scratch/` for temporary work.
