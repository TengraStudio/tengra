# Development Guide

This guide provides the necessary information to set up, develop, and test Tengra. We prioritize stability and security by following strict coding standards and a rigorous build process.

## Environment Setup

### Prerequisites
To build and run Tengra locally, you need the following tools:
- **Node.js**: v18.0.0 or higher is required for the main application.
- **Git**: Ensure you have the latest version for version control.
- **Go**: v1.21+ is required to compile the `cliproxy-embed` microservice.
- **Rust and Cargo**: latest stable version is required for the token, model, and memory services.
- **Build Tools**: 
    - On Windows: Visual Studio Build Tools (C++).
    - On Linux/macOS: GCC or Clang and standard build utilities.

### Initial Configuration
1. Clone the repository and navigate to the root directory.
2. Run `npm install` to install all Node.js dependencies.
3. Run `npm run build` to perform an initial compilation of the TypeScript code and all native microservices.
4. Run `npm run dev` to start the application in development mode with Hot Module Replacement (HMR).

## Coding Standards

Tengra follows high-integrity software standards to ensure the application remains reliable over time.

### Core Principles
- **Type Safety**: The use of `any` or `unknown` is forbidden. Always define specific interfaces or use narrowed types.
- **Documentation**: All new features must be documented in the `docs/` folder before the code is merged.
- **Build Integrity**: You must never push code that fails the `npm run build` process locally.
- **Performance**: Keep the main thread responsive by offloading heavy tasks to background services or native microservices.

### Function and Logic Rules
- **Length**: Functions should be concise and perform a single task. We target a maximum of 60 lines per function.
- **Loops**: Every loop must have a defined exit condition. Avoid recursive calls that do not have a clear base case.
- **Validation**: All public service methods must validate their inputs before processing.

## Architecture and Style

- **Service Layer**: Services are the backbone of Tengra. They should be modular, domain-specific, and reside in `src/main/services/`.
- **Path Aliasing**: Use the following aliases to keep imports clean:
    - `@main/`: `src/main/`
    - `@renderer/`: `src/renderer/`
    - `@shared/`: `src/shared/`
- **Logging**: Do not use `console.log`. Instead, use the centralized `appLogger` which handles rotating log files and formatting.

## Testing and Verification

Verifying code quality is a mandatory step in our development lifecycle.

- **Unit Testing**: We use Vitest for its speed and compatibility with Vite. Run `npm run test` to execute the suite.
- **Coverage**: Critical logic, especially around authentication and token management, must maintain high test coverage.
- **Type Checking**: Run `npm run type-check` to identify potential type mismatches across the entire project.

## Build and Release Process

The build process is complex because it involves multiple languages.
1. **TypeScript Compilation**: The `tsc` compiler validates types and outputs JavaScript.
2. **Linting**: ESLint checks for rule violations and potential bugs.
3. **Frontend Build**: Vite bundles the React code, assets, and styles for the renderer process.
4. **Native Compilation**: A custom script (`scripts/build-native.js`) triggers `go build` and `cargo build`, then moves the resulting binaries to the `resources/bin` directory.
5. **Packaging**: Electron Builder packages the binaries and assets into an executable installer.


