# Project Structure

Tandem follows a strict organizational pattern to manage its multi-process architecture. This ensures a clear separation of concerns and makes the codebase easier to navigate for developers.

## Repository Overview

```text
Tandem/
├── brain/              # Task artifacts, plans, and persistent agent state
├── docs/               # Technical documentation and project guides
├── resources/          # Static assets, icons, and native binaries for distribution
├── scripts/            # Automation scripts for builds, linting, and environment setup
├── src/                # Primary source code for the application
│   ├── main/           # Node.js code for the Electron Main process
│   ├── renderer/       # React code for the Electron Renderer process
│   ├── shared/         # Universal types and constants used across processes
│   └── services/       # Native microservices (Rust and Go)
├── tests/              # Centralized test suites (Unit, Integration, E2E)
└── vendor/             # External source trees and pre-compiled dependencies
```

## Main Process (src/main)

The Main process acts as the application's backend. It is responsible for low-level system access, service orchestration, and managing the lifecycle of the window and microservices.

- **ipc/**: Contains the logic for handling requests from the UI. This layer acts as a router, forwarding calls to the appropriate services.
- **services/**: These are self-contained modules that handle specific domains:
    - **data/**: Manages the PGlite database, migrations, and schema definitions.
    - **llm/**: Handles the logic for interacting with various AI models.
    - **security/**: Responsible for encryption, decryption, and secure token management.
    - **proxy/**: Manages the lifecycle and configuration of the embedded Go proxy.
- **startup/**: Orchestrates the initialization sequence, including service registration and dependency injection.

## Renderer Process (src/renderer)

The Renderer process is a standard React application. It is restricted from direct system access and communicates with the Main process via IPC.

- **components/**: Small, reusable UI elements built with React and Vanilla CSS.
- **features/**: High-level modules that encapsulate the logic and views for major application areas, such as the Chat interface or the Settings dashboard.
- **hooks/**: Custom React hooks for managing state and side effects, often used to bridge the gap between the UI and IPC calls.
- **assets/**: Images, fonts, and global style definitions.

## Shared Code (src/shared)

To ensure consistency and type safety, we share code between the Main and Renderer processes. This directory must only contain "pure" code that does not depend on Node.js or browser-specific APIs.

- **types/**: Centralized TypeScript definitions that ensure both ends of an IPC call are using the same data structures.
- **constants/**: Shared configuration values, event names, and error codes.

## Native Microservices (src/services)

This directory contains the source code for our systems-level microservices.
- **token-service/**: A Rust-based service for monitoring and refreshing authentication tokens.
- **cliproxyapi/**: The Go source for our embedded authentication and routing proxy.

## Development and Build Scripts (scripts)

These scripts handle the complexity of compiling a polyglot codebase.
- **build-native.js**: Coordinates the compilation of Go and Rust binaries.
- **clean.js**: Safely removes build artifacts and temporary data during troubleshooting.
- **setup.js**: Prepares the local environment for new developers.

