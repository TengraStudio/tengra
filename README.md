# Tandem 🏮

Tandem is a powerful, open-source AI assistant designed to streamline your development workflow by integrating various LLM providers (Ollama, Antigravity, GitHub Copilot) into a unified, high-performance desktop application.

> [!IMPORTANT]
> **LEGAL DISCLAIMER**: This project is an unofficial client and is not affiliated with, endorsed by, or connected to GitHub, Microsoft, Google, Anthropic, or any of their subsidiaries. All trademarks and brand names are the property of their respective owners. Tandem provides interoperability layers for research and educational purposes. **Users are responsible for ensuring their usage of third-party APIs complies with the respective providers' Terms of Service.**

## Key Features
- **Multi-Model Support**: Chat with Ollama (Local), Antigravity, Copilot, and more.
- **Browser Extension**: AI-powered browser control with DOM manipulation, form filling, and content extraction.
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

We welcome contributions! Please see our [CONTRIBUTING.md](docs/CONTRIBUTING.md) for detailed guidelines and our code of conduct.

## Browser Extension

Tandem includes a powerful browser extension that enables AI to interact directly with web pages. See [`extension/README.md`](extension/README.md) for installation instructions.

### Quick Setup
1. Start the Tandem desktop app
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the `extension` folder
5. Click the extension icon to start chatting with AI about any webpage

The extension allows the AI to:
- 📖 Read and extract page content
- 🖱️ Click buttons and interact with elements  
- ✍️ Fill forms automatically
- 📊 Analyze and summarize web content
- 🔒 All communication stays local on your computer

## Security & Privacy
Tandem is built with privacy in mind. It uses a "Bring Your Own Key" (BYOK) model. No API keys or personal data are stored on our servers; everything remains on your local machine.

## License
This project is licensed under the **GNU General Public License v3.0 (GPLv3)** - see the [LICENSE](LICENSE) file for details. This ensures the project remains free and open-source for everyone.
