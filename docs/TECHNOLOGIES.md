# Technology Stack

Orbit is a high-performance desktop application built with a modern, polyglot architecture. We leverage the strengths of several languages and frameworks to provide a secure, fast, and feature-rich AI coding environment.

## 1. Core Runtime
- **[Electron](https://www.electronjs.org/)**: The backbone of the application, combining Node.js for system access and Chromium for the user interface.
- **Node.js**: Powers the Main process and the extensive service layer.

## 2. Frontend (Renderer)
- **[React](https://reactjs.org/)**: UI library used with a functional component approach and Hooks.
- **[TypeScript](https://www.typescriptlang.org/)**: Strict typing across the entire frontend to prevent common runtime errors.
- **[Tailwind CSS](https://tailwindcss.com/)**: Utility-first CSS framework for rapid UI development and consistent styling.
- **[Framer Motion](https://www.framer.com/motion/)**: Powers smooth micro-animations and complex transitions (e.g., 3D card effects).
- **[Monaco Editor](https://microsoft.github.io/monaco-editor/)**: The code editor engine behind VS Code, used for high-quality code viewing and editing within Orbit.

## 3. Dedicated Microservices
Orbit offloads heavy or provider-specific tasks to independent microservices built with systems languages for maximum efficiency.

### Rust Microservices
All Rust services are built using the **Axum** web framework and **Tokio** runtime. They run as independent HTTP servers on ephemeral ports.
- **Token Service**: Manages OAuth token refresh cycles and monitoring.
- **Model Service**: Handles model discovery and metadata aggregation.
- **Quota Service**: Tracks usage limits across various LLM providers.
- **Memory Service**: Manages vector-based episodic and semantic memory.

### Go Proxy
- **CLIProxy-Embed**: A high-speed proxy built in Go that handles local-to-cloud request routing, authentication header injection, and response streaming for providers like Antigravity and Claude.

## 4. Storage & Persistence
- **[PGlite](https://pglite.dev/)**: A WASM-based build of PostgreSQL that runs entirely within the Node.js process. It provides the full power of a relational database without requiring a separate server installation.
- **Vector Extension**: Used for semantic search and AI memory features.

## 5. Development & Tooling
- **[Vite](https://vitejs.dev/)**: Next-generation frontend tooling for extremely fast development builds and optimized production bundles.
- **[Vitest](https://vitest.dev/)**: Blazing fast unit test runner used for all service and utility tests.
- **[Playwright](https://playwright.dev/)**: Used for end-to-end (E2E) testing to ensure critical user flows remain stable.
- **ESLint & Prettier**: Enforce strict coding standards and consistent code formatting.

## 6. Communication Architecture
- **IPC Bridge**: Secure, typed Inter-Process Communication between Renderer and Main.
- **HTTP/REST**: Bidirectional communication between Orbit Main and the Rust/Go microservices.
- **WebSockets/SSE**: Used for real-time streaming of AI responses.
