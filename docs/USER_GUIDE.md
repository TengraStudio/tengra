# Orbit User Guide

Welcome to Orbit, an advanced AI-powered workspace designed for developers. Orbit balances high-performance cloud models with local-first privacy.

---

## 1. Getting Started

### Installation
1. **Download**: Get the latest installer for your OS.
2. **Install**: Run the installer. On Windows, it's a standard `.exe`.
3. **Setup**: Orbit automatically detects local installations of **Ollama** on first launch.

### Configuring AI Models

#### Local Models (Privacy-First)
1. Ensure **Ollama** is running.
2. Go to **Settings** > **Models** and click "Refresh".
3. Your local models (Llama 3, Mistral, etc.) will appear in the chat dropdown.

#### Cloud Models (Power)
1. Go to **Settings** > **Accounts**.
2. Log in or enter API keys for **OpenAI**, **Anthropic**, or **Antigravity**.
3. These models will now be available for selection.

---

## 2. Using the Workspace

### Chat Interface
- **New Chat**: `Ctrl+N` or click the "+" icon.
- **Context**: Attach files via the paperclip icon or drag-and-drop.
- **Voice**: Use the microphone icon for voice-to-text input.
- **Pinning**: Keep important chats at the top using the pin icon.

### Project Management
- **Add Connection**: In the Projects view, click "+" to connect a local folder or remote server.
- **SSH Support**: Connect to remote environments by providing hostname and credentials.
- **Add to Context**: Right-click files/folders in the explorer to focus the AI's attention on specific parts of your project.

### The Council
Specialized AI agents are available in the "Council" tab:
- **Planner**: Helps decompose complex tasks.
- **Reviewer**: Analyzes code for bugs and improvements.
- **Architect**: Designs high-level systems.

---

## 3. Advanced Features

- **Slash Commands**: Type `/` in the input field to access templates.
- **Shortcuts**: `Ctrl+/` opens the keyboard shortcut cheat sheet.
- **Multi-Model Collaboration**: Select multiple models to compare responses or reach a consensus.

---

## 4. Privacy & Security

- **Local Processing**: Data sent to local models never leaves your machine.
- **Encryption**: your API keys and sensitive credentials are encrypted using the OS keychain or local secure store.
- **File Access**: Orbit only reads files you explicitly add to the context or browse in the project explorer.

---

## 5. Troubleshooting

- **Models not appearing**: Verify the provider is authenticated in Settings.
- **Generation fails**: Check your API quota or internet connection.
- **Performance**: Large local models require significant RAM; close other applications if you experience lag.
