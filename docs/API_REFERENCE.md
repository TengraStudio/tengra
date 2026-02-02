# Internal API Reference

Tandem uses internal APIs to coordinate activity between the Electron main process and its native microservices. This document provides a reference for the endpoints used in our bidirectional communication model.

## Authentication API (Main Process)

The `AuthAPIService` acts as a secure gateway for microservices to retrieve or update authentication data.

- **Interface**: Internal HTTP Server.
- **Port**: Assigned dynamically at startup.
- **Security**: All requests must include a Bearer token containing the system-generated secret key.

### GET /api/auth/accounts
Retrieves a list of all linked accounts. The tokens returned by this endpoint are decrypted and ready for use by the proxy microservice.

### POST /api/auth/accounts/:id
Allows a microservice to update the tokens for a specific account. This is primarily used by the token-service after a successful background refresh.

## Token Service API (Rust)

The token service is responsible for the background maintenance of credentials. It runs as an independent Rust process.

### POST /monitor
Registers a token with the service. Once registered, the service will periodically check the token's expiration and execute a refresh flow if necessary.

### POST /unregister
Unregisters a token from monitoring. This is called by the `AuthService` when a user unlinks an account, ensuring that background refresh attempts stop immediately for that ID.

### GET /sync
Returns the current state of all monitored tokens. This is used for diagnostic purposes to verify which accounts are currently being tracked.

## Communication Patterns

### Service Discovery
Microservices identify the correct port for the Main process API through environment variables or command-line flags passed during the spawning process. This ensures that even with dynamic port assignment, the services can always find each other.

### Serialization and Protocols
- **JSON**: We use standardized JSON schemas for all internal requests and responses to ensure compatibility across different languages (TypeScript, Go, Rust).
- **Timeouts**: Every internal request is subject to a 5-second timeout. If a service does not respond within this window, the requester must handle the failure gracefully.
- **Error Propagation**: Internal API errors include a structured JSON body with an error code and a human-readable message, which are mapped back to application-level exceptions.

### Secure Transport
While these APIs run on `localhost`, we still enforce authentication using secret keys. This prevents other local applications from interacting with Tandem's internal control plane.

