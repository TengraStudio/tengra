# Orbit User Guide

## Getting Started

Welcome to Orbit, your new AI-powered workspace. This guide will help you set up and navigate the application to get the most out of your AI workflow.

### Installation

1.  **Download**: Get the latest installer for your operating system from the releases page.
2.  **Install**: Run the installer (`.exe` on Windows). The application will install and launch automatically.
3.  **Initial Setup**: On first launch, Orbit will run a quick system check to detect if you have Ollama installed for local models.

### Configuring AI Models

Orbit works with both local and cloud models.

#### Local Models (Ollama)
If you want to run models privately on your own machine:
1.  Ensure **Ollama** is installed and running.
2.  In Orbit, go to **Settings** > **Models**.
3.  Click "Refresh" to detect your installed Ollama models (like Llama 3, Mistral, etc.).
4.  Select a model from the chat dropdown to start using it.

#### Cloud Models (OpenAI, Anthropic, Antigravity)
For access to powerful cloud models:
1.  Go to **Settings** > **Accounts**.
2.  Log in or enter your API keys for the respective services.
3.  Once authenticated, these models will appear in your model selector dropdown.

## Using the Workspace

### The Chat Interface
This is your main command center.
*   **New Chat**: Click the "+" icon in the sidebar or press `Ctrl+N`.
*   **Send Message**: Type your prompt and press `Enter`. Hold `Shift+Enter` for a new line.
*   **Attachments**: Click the paperclip icon or drag and drop files into the chat access them in your prompt.
*   **Voice Mode**: Click the microphone icon to speak your prompts.

### Projects and Files
Connect your code to Orbit to let the AI help you work.
1.  Go to the **Projects** view (Grid icon in the sidebar).
2.  Click the "+" button in the file explorer to "Add Connection."
3.  Choose **Local Folder** to select a directory on your computer.
4.  Once added, you can browse files, and right-click to "Add to Context" so the AI can read them.

### SSH Remote Development
You can also connect to remote servers.
1.  In "Add Connection," select **SSH**.
2.  Enter your host, username, and key path.
3.  Browse the remote file system just like a local folder.

### The Council
Use "The Council" to get specialized help.
1.  Navigate to the Council tab.
2.  Select specialized agents (e.g., "Reviewer", "Architect").
3.  These agents have pre-configured system prompts designed for specific tasks.

## Tips and Tricks
*   **Slash Commands**: Type `/` in the chat input to quickly access your saved prompts.
*   **Keyboard Shortcuts**: Press `Ctrl+/` to view all available keyboard shortcuts.
*   **Pinning Chats**: Hover over a chat in the sidebar and click the pin icon to keep important conversations at the top.

## Troubleshooting
If you encounter issues:
*   **Local Models Won't Load**: Make sure the Ollama application involves running in the background.
*   **Connection Error**: Check your internet connection if using cloud models.
*   **App Unresponsive**: Try reloading the window via `View` > `Reload` or restarting the application.
