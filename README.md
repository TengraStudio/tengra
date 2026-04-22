# Tengra

Tengra is a desktop AI assistant for local and remote development workflows. It combines provider accounts, local model tooling, workspaces, terminal access, MCP/plugin expansion, and native sidecar services in one Electron application.

This project is an unofficial client and is not affiliated with GitHub, Microsoft, Google, Anthropic, OpenAI, NVIDIA, or their subsidiaries. Users are responsible for complying with each provider's terms.

## Quick Start

Requirements:

- Node.js 20 or newer
- Rust stable toolchain
- Visual Studio Build Tools on Windows for native service builds

```bash
git clone https://github.com/TengraStudio/tengra.git
cd tengra
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run build:exe
```

## Documentation

Start with [docs/README.md](docs/README.md) for the full documentation index.

Common entry points:

- [Contributing](docs/CONTRIBUTING.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Project Structure](docs/PROJECT_STRUCTURE.md)
- [Managed Runtime](docs/MANAGED_RUNTIME.md)
- [Security](docs/SECURITY.md)
- [Release Checklist](docs/RELEASE_CHECKLIST.md)

Before opening a release PR, run:

```bash
npm run type-check
npm run lint
npm test
npm run build
npm run secrets:scan
npm run audit:deps:gate
```

## License

Tengra is licensed under GPL-3.0. See [LICENSE](LICENSE).
