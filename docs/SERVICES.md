# Service Architecture

Orbit is built on a modular, service-oriented architecture. By centralizing logic into domain-specific services, we maintain a codebase that is easy to test, debug, and extend.

## BaseService and Lifecycle

All services in Orbit inherit from a central `BaseService` class. This provides a consistent interface and set of utilities for every module in the system.

- **Initialization**: Every service has an `initialize()` method. This is where asynchronous setup—such as connecting to a database or starting a child process—should occur.
- **Cleanup**: The `cleanup()` method is called when the application is shutting down. Services use this to close file handles, stop timers, or signal microservices to terminate.
- **Structured Logging**: `BaseService` provides built-in methods for logging (`logInfo`, `logError`, `logWarn`). These methods automatically include the service name in the log output, making it easier to trace events back to their source.

## Service Domains

We organize services into logical domains to minimize cross-dependencies and ensure each module has a clear responsibility.

### Security Domain
This domain handles the protection of user data and the management of authentication states.
- **TokenService**: Monitors the health of OAuth tokens and coordinates background refreshes with the Rust microservice.
- **AuthService**: Manages the local account database and handles the complex logic of token encryption.
- **SecurityService**: Provides low-level cryptographic primitives, integrating with both Orbit's custom AES implementation and OS-level secure storage.

### Data Domain
Responsible for all persistent storage and data integrity.
- **DatabaseService**: Manages the lifecycle of the PGlite database, including schema migrations and query execution.
- **BackupService**: Handles the secure export and import of user data, ensuring that snapshots are consistent.

### System and Proxy Domain
Handles the execution of external processes and system-level operations.
- **ProxyProcessManager**: Specifically manages the lifecycle of the Go-based authentication proxy, including configuration generation and error monitoring.
- **CommandService**: Provides a secured wrapper for executing shell commands, automatically sanitizing inputs to prevent injection attacks.

### LLM Domain
Orchestrates the interaction with various AI models.
- **MultiLLMOrchestrator**: Acts as a dispatcher, routing chat requests to the appropriate model provider while handling fallbacks and streaming.
- **ModelRegistryService**: Maintains a cached list of available models and their capabilities across different providers.

## Dependency Injection and Orchestration

Orbit uses a centralized dependency injection pattern to manage service relationships. Instead of services instantiating their own dependencies, they are "injected" during the startup sequence.

### Registration Process
During application startup, all services are registered in a central container. This process defines the order in which services are initialized, ensuring that low-level services (like `DatabaseService`) are ready before high-level services (like `AuthService`) attempt to use them.

### Benefits for Testing
Because services receive their dependencies through their constructors, we can easily inject "mock" versions of those dependencies during unit testing. This allows us to test a single service in isolation without requiring the entire application to be running.

