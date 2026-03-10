# Tengra 🏮

Tengra is a powerful, open-source AI assistant designed to streamline your development workflow by integrating various LLM providers (Ollama, Antigravity, GitHub Copilot) into a unified, high-performance desktop application.

> [!IMPORTANT]
> **LEGAL DISCLAIMER**: This project is an unofficial client and is not affiliated with, endorsed by, or connected to GitHub, Microsoft, Google, Anthropic, or any of their subsidiaries. All trademarks and brand names are the property of their respective owners. Tengra provides interoperability layers for research and educational purposes. **Users are responsible for ensuring their usage of third-party APIs complies with the respective providers' Terms of Service.**

## ✨ Key Features

- **Multi-Model Support**: Chat with Ollama (Local), Antigravity, Copilot, and more.
- **Agent Council**: Multi-agent collaboration (Planner, Executor, Critic) for complex tasks.
- **Browser Extension**: AI-powered browser control with DOM manipulation and content extraction.
- **SSH Workspaces**: Edit files and manage projects on remote servers directly via SSH.
- **Project Management**: Built-in task tracking and `TODO.md` integration.
- **Offline First**: Optimized for privacy and local-first data storage.

---

## 📚 Documentation Index

| Document | Description |
|----------|-------------|
| [AI_RULES.md](./AI_RULES.md) | **MANDATORY**: Coding standards and AI agent guidelines. |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, project structure, and database schema. |
| [API.md](./API.md) | IPC channels and internal REST API. |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Development guide, setup instructions, and contribution rules. |
| [SECURITY.md](./SECURITY.md) | Security policy, encryption standards, and vulnerability reporting. |
| [GUIDE.md](./GUIDE.md) | User guide, model connection, and troubleshooting. |
| [TODO.md](./TODO.md) | Project backlog and priority tasks. |
| [IPC_CHANNELS.md](./IPC_CHANNELS.md) | Full reference of all 600+ IPC channels. |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v20+
- **Go**: v1.21+ (for native proxy)
- **Rust**: Latest stable (for native token/model services)

### Installation
```bash
git clone https://github.com/TengraStudio/tengra.git
cd tengra
npm install
npm run setup-build-env
```

### Running the App
```bash
# Development mode
npm run dev

# Build for production
npm run build
```

## 🤝 Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines and our code of conduct.

## 🛡️ Security & Privacy

Tengra is built with privacy in mind. It uses a "Bring Your Own Key" (BYOK) model. No API keys or personal data are stored on our servers; everything remains on your local machine. See [SECURITY.md](./SECURITY.md) for more.

## 📄 License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)** - see the [LICENSE](LICENSE) file for details.
