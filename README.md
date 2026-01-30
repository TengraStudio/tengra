# Tandem 🏮

Tandem is a powerful, open-source AI assistant designed to streamline your development workflow by integrating various LLM providers (Ollama, Antigravity, GitHub Copilot) into a unified, high-performance desktop application.

> [!IMPORTANT]
> **LEGAL DISCLAIMER**: This project is an unofficial client and is not affiliated with, endorsed by, or connected to GitHub, Microsoft, Google, Anthropic, or any of their subsidiaries. All trademarks and brand names are the property of their respective owners. Tandem provides interoperability layers for research and educational purposes. **Users are responsible for ensuring their usage of third-party APIs complies with the respective providers' Terms of Service.**

## Key Features
- **Multi-Model Support**: Chat with Ollama (Local), Antigravity, Copilot, and more.
- **SSH Workspaces**: Edit files and manage projects on remote servers directly via SSH.
- **Project Management**: Built-in task tracking and `TODO.md` integration.
- **Git Integration**: AI-powered commit message generation.
- **Offline First**: Optimized for privacy and local-first data storage.

## Getting Started
### Prerequisites
- Node.js (v20+)
- npm

### Installation
```bash
git clone https://github.com/TengraStudio/tandem.git
cd tandem
npm install
```

### Running the App
```bash
# Development mode
npm run electron:dev

# Build for production
npm run electron:build
```

## Security & Privacy
Tandem is built with privacy in mind. It uses a "Bring Your Own Key" (BYOK) model. No API keys or personal data are stored on our servers; everything remains on your local machine.

## License
This project is licensed under the **GNU General Public License v3.0 (GPLv3)** - see the [LICENSE](LICENSE) file for details. This ensures the project remains free and open-source for everyone.
