# Tandem User Guide

Welcome to Tandem, a professional AI-powered workspace built to streamline your development workflow. Tandem provides a unified interface for multiple AI providers while maintaining a strong focus on privacy and local execution.

## Getting Started

### Installation and First Run
To get started with Tandem, download the appropriate installer for your operating system and follow the standard installation prompts. On the first launch, Tandem will perform a system check to detect local tools like Ollama or Git and configure the internal data directories.

### Connecting AI Providers
Tandem supports a wide range of AI models. You can manage these connections in the Settings menu.

- **Local Models**: If you have Ollama installed, Tandem will automatically detect your downloaded models. You can refresh the model list in the Settings dashboard.
- **Local Image Generation (SD-CPP)**: Tandem includes a high-performance Stable Diffusion C++ implementation for local image generation. This runs entirely on your machine and is detected/configured automatically if enabled in settings. If SD-CPP is unavailable or fails, Tandem will automatically fallback to **Pollinations** (cloud-based) to ensure your workflow is not interrupted.
- **Cloud Accounts**: To use models from providers like Anthropic or Google, navigate to the Accounts section in Settings. Tandem uses secure OAuth flows for account linking. For providers requiring API keys, your credentials will be encrypted and stored securely in the system keychain.

## Navigating the Workspace

### The Chat Interface
The chat represents your primary interaction point with the AI.
- **Starting a Conversation**: Use the New Chat button to begin a fresh session.
- **Providing Context**: You can attach specific files to your chat session using the context menu or by dragging files directly into the window. This allows the AI to understand the code you are currently working on.
- **Model Selection**: Use the dropdown menu at the top of the chat window to switch between different AI models. You can even select multiple models for a collaborative response.

### Managing Projects
The Projects view allows you to organize your work by linking local folders or remote servers.
- **Local Folders**: Link existing projects on your machine to enable deep semantic indexing and workspace-aware AI suggestions.
- **Remote SSH Connections**: Tandem includes a built-in SSH manager as well as an SFTP browser. You can connect to remote servers by providing your connection details and credentials.

### The Agent Council
For complex tasks that require more than a simple chat, you can utilize the Council. This feature allows you to engage specialized AI personas—such as a Planner, an Executor, or a Critic—that work together to solve a problem.

## Security and Privacy

Tandem is designed with a local-first philosophy.
- **Data Sovereignty**: When using local models, your code and conversation history never leave your machine.
- **Secure Persistence**: All sensitive data, including API tokens and session keys, are encrypted at rest using industry-standard AES-256-GCM.
- **Controlled Access**: The AI agents can only interact with files and directories that you have explicitly granted access to within the project settings.

## Troubleshooting Common Issues

- **Connection Errors**: Ensure your internet connection is stable when using cloud providers. If you are behind a proxy, verify your system-wide proxy settings.
- **Model Discovery**: If a local model is not appearing, verify that the Ollama daemon is running and that the model has been successfully pulled to the local library.
- **Performance**: High-end local models require significant system resources. We recommend a minimum of 16GB of RAM for the best experience with 7B+ parameter models.

