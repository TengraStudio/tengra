# Orbit AI Assistant

Orbit is an advanced AI coding assistant and workspace manager designed to integrate local and cloud based AI models directly into your development workflow. It provides a unified interface for project management, code intelligence, and autonomous agent collaboration.

## Project Goals

The primary goal of Orbit is to bridge the gap between local development environments and powerful AI capabilities. It aims to:

1. Provide a privacy focused, local first AI assistance experience using models like Ollama and Llama.cpp.
2. Enable seamless integration with cloud providers like OpenAI and Anthropic through a unified proxy layer.
3. Offer an "AI Council" of specialized agents (Planner, Builder, Reviewer) to autonomously handle complex coding tasks.
4. Simplify project exploration and management with a custom workspace interface.

## Usage and Risks

### Experimental Status

This software is currently in an experimental phase. Features may be unstable, and significant changes to the architecture (such as the recent refactoring of the ViewManager and Proxy services) are frequent.

### Data Privacy

While Orbit supports local models, using cloud providers involves sending data to external servers.

* **Local Models:** Data processed by Ollama or Llama.cpp remains on your machine.
* **Cloud Models:** Prompts and code snippets are transmitted to the respective providers (e.g., OpenAI, Google). Ensure you comply with your organization's data security policies before using cloud models.

### System Access

Orbit has extensive access to your file system to perform its duties (reading code, writing files, creating directories).

* **File Operations:** The agent can modify or delete files. Always use a version control system (git) to revert unwanted changes.
* **Terminal Access:** The application includes a terminal interface. Commands executed by the agents or the user have full user privileges.

### Dependency Management

The project relies on several vendored binaries (cliproxy, llama-server). Ensure these are sourced from trusted locations. The recent restructuring has moved these to the `vendor` directory to better manage external dependencies.

## Architecture Overview

* **Frontend:** React, TailwindCSS, and Framer Motion for a responsive and modern UI.
* **Backend:** Electron with a Node.js main process, handling IPC communication and service orchestration.
* **Services:** Modular services (LlamaService, ProxyService, etc.) manage specific domains.
* **Vendor:** External binaries and SDKs are encapsulated in the `vendor` directory.

## Contributing

Please refer to `UPDATES.md` for the change log and `docs/TODO.md` for planned features. All development should follow the established project structure and coding standards.
