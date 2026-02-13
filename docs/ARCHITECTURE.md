# System Architecture

Tandem is built with a multi-process, polyglot architecture designed to maximize security, performance, and developer flexibility. This document provides a detailed look at how the different components of Tandem interact to provide a seamless AI coding experience.

## Process Model and Communication

Tandem utilizes Electron's multi-process architecture to isolate the user interface from the intensive system-level logic.

### Renderer Process (UI)
The frontend is a React application that runs in a context-isolated environment. It has no direct access to the operating system or the Node.js runtime. This isolation is a critical security measure against remote code execution via malicious AI outputs.

### Main Process (Orchestration)
The Main process serves as the central hub. It manages the application's lifecycle, coordinates the service layer, and handles communication with external microservices. All high-level business logic resides here, including the agent council and workspace management.

### Inter-Process Communication (IPC)
Communication between the Renderer and Main process occurs over a secure IPC bridge. We use a strictly whitelisted set of methods to ensure that the UI can only perform authorized actions.

## Service Oriented Architecture

The Main process is organized into self-contained services, each responsible for a specific domain. These services are managed through a dependency injection container, which handles their initialization and lifecycle.

### Domain Breakdown
- **Security and Auth**: Manages encryption, user accounts, and the secure storage of credentials.
- **LLM Orchestration**: Handles the routing of requests to various AI providers and manages the concurrent execution of multiple models.
- **Workspace Management**: Indexes the user's project, manages file operations, and provides context to the AI agents.
- **Microservice Management**: Responsible for starting, stopping, and monitoring our specialized native binaries.

## Native Microservices

To handle tasks that require high performance or low-level networking capabilities, Tandem delegates work to specialized microservices.

### Go Proxy (CLIProxy-Embed)
The Go proxy is the gateway for all external LLM communication. It manages:
- **Request Routing**: Directing outgoing calls to the correct provider endpoint.
- **Auth Injection**: Dynamically adding the required authentication headers to requests using tokens retrieved from the Main process.
- **Streaming Optimization**: Buffering and forwarding model responses to the UI with minimal latency.

### Rust Token Service
This service is dedicated to the background maintenance of authentication tokens. It monitors the expiration of various credentials and executes refresh flows in the background, ensuring that the user's session remains active without manual intervention.

## Secure Proxy Routing

Tandem implements a "stateless" approach to credential handling. Tokens are stored in an encrypted database and only decrypted in memory when an outgoing request is initiated. The decrypted tokens are sent to the Go proxy over a localized HTTP interface, which is secured by a system-generated secret key. This design ensures that raw credentials never touch the disk in an unencrypted state.

## Data Persistence and Memory

### PGlite (PostgreSQL)
We use an embedded version of PostgreSQL (PGlite) for all relational data. This provides a robust and scalable storage layer for user settings, chat histories, and project metadata.

### Semantic Memory (Vector Search)
For long-term agent memory, we utilize vector embeddings stored within our database. This allows the agent to perform semantic searches across the user's codebase, providing relevant context even for large and complex projects.

## Agent Lifecycle

1. **Task Decomposition**: When a user submits a complex request, the Planner agent breaks it down into a sequence of actionable steps.
2. **Context Gathering**: The agent uses tools to read the relevant files, execute discovery commands, and pull information from the semantic memory.
3. **Execution and Verification**: For each step, the Executor agent modifies code or performs system actions, followed by a verification step where the results are reviewed against the original plan.
4. **Audit and Refinement**: A Critic agent reviews the final output to ensure it meets quality standards and doesn't introduce regressions.

## Architecture Decisions

Formal decisions are tracked in `docs/adr/`:

- `0001-electron-multi-process-architecture.md`
- `0002-structured-changelog-source-of-truth.md`
- `0003-service-oriented-main-process.md`



