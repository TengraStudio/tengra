# Tengra

Tengra is a professional, high-performance desktop AI assistant designed for enterprise-grade development workflows. It integrates advanced LLM providers, including Ollama, Antigravity, and GitHub Copilot, into a unified and secure orchestration environment.

## Critical Notice
This project is an unofficial client and is not affiliated with, endorsed by, or connected to GitHub, Microsoft, Google, Anthropic, or any of their subsidiaries. All trademarks and brand names are the property of their respective owners. Tengra provides interoperability layers for research and educational purposes. Users are responsible for ensuring their usage of third-party APIs complies with the respective providers' Terms of Service.

## Core Capabilities

- **Multi-Provider Integration**: Native support for Ollama (local), Antigravity (cloud), and GitHub Copilot.
- **Agent Orchestration**: Advanced multi-agent collaboration system utilizing Planner, Executor, and Critic roles for complex reasoning tasks.
- **Integrated Development Environment**: Seamless interaction with local and remote workspaces, featuring file system management and terminal integration.
- **Remote Workspaces**: Direct SSH integration for managing projects and executing operations on remote infrastructure.
- **Privacy and Security**: Local-first architecture with encrypted sensitive data storage and zero-telemetry by default for core AI interactions.

## Technical Architecture

Tengra is built on a robust, multi-process architecture based on Electron 40 and React 18. Performance-critical operations are delegated to native services written in Rust and Go, ensuring low latency and high reliability.

- **Main Process**: Node.js-based orchestration layer for service management and system integration.
- **Renderer Process**: High-density React application utilizing specialized stores for state management and an IPC-bridge for secure communication.
- **Native Microservices**: Rust-based services for database operations (PGlite/SQLite) and Go-based proxy for optimized network routing.
- **Local Inference**: Native integration with Ollama and Llama.cpp for high-performance local LLM execution.

## Documentation Index

| Document | Description |
|----------|-------------|
| [AI_RULES.md](./AI_RULES.md) | Mandatory coding standards and agent behavioral guidelines. |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Comprehensive system design, process model, and database schemas. |
| [API.md](./API.md) | IPC contract definitions and internal communication protocols. |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Development setup instructions and contribution standards. |
| [SECURITY.md](./SECURITY.md) | Security policy, encryption protocols, and vulnerability reporting. |
| [GUIDE.md](./GUIDE.md) | Technical usage guide and connectivity troubleshooting. |
| [TODO.md](./TODO.md) | Project roadmap and prioritized backlog. |

## Installation and Setup

### Prerequisites
- Node.js v20.x or higher
- Go v1.21+ (for native proxy infrastructure)
- Rust (latest stable) for core native services

### Initial Setup
```bash
git clone https://github.com/TengraStudio/tengra.git
cd tengra
npm install
npm run setup-build-env
```

### Execution
```bash
# Start development environment
npm run dev

# Compile production build
npm run build

# Generate platform-specific installers
npm run build:exe    # Windows (x64)
npm run build:mac    # macOS (Universal)
npm run build:linux  # Linux (AppImage/deb)
```

## Governance and Licensing

Tengra is an open-source project licensed under the GNU General Public License v3.0 (GPLv3). Contributions are subject to the project's standards of type safety and performance as outlined in the documentation.
