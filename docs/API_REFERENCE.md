# Internal API Reference

Orbit communicates with its native microservices (Go/Rust) using high-performance internal APIs. This document tracks the endpoints and communication patterns used for cross-process synchronization.

## 1. Auth HTTP API

**Service**: `AuthAPIService`
**Port**: Dynamic (available via `--auth-api-port` flag or discovery file)
**Security**: Requires `Authorization: Bearer <SecretKey>`

### GET `/api/auth/accounts`
Retrieves all linked accounts with decrypted tokens.
- **Response**:
  ```json
  {
    "accounts": [
      {
        "id": "uuid",
        "provider": "claude",
        "access_token": "...",
        "refresh_token": "...",
        "metadata": { "type": "claude", "email": "..." }
      }
    ]
  }
  ```

### POST `/api/auth/accounts/:id`
Updates a specific account's tokens (e.g., after a background refresh).
- **Body**:
  ```json
  {
    "access_token": "...",
    "refresh_token": "...",
    "expires_at": 123456789,
    "metadata": { ... }
  }
  ```
- **Response**: `{ "success": true }`

---

## 2. Token Service API (Rust)

**Service**: `orbit-token-service`
**Interface**: HTTP (Ephemeral Port)

### POST `/monitor`
Registers a token for background monitoring and automated refresh.
- **Payload**: `AuthToken` struct + Client ID/Secret.

### GET `/sync`
Retrieves all currently monitored tokens and their latest status from memory.

---

## 3. Proxy Discovery Pattern

Microservices discover Orbit's API port through several channels:
1. **Command Line Flags**: Passed during spawn (`-auth-api-port`).
2. **Port Files**: Written to `%APPDATA%\Orbit\services\*.port`.
3. **Environment Variables**: `ORBIT_AUTH_API_PORT`.

---

## 4. Communication Guidelines

- **Statelessness**: Favor stateless HTTP requests over persistent socket connections where possible.
- **Serialization**: JSON is the standard serialization format for all internal APIs.
- **Timeouts**: All internal requests should implement a strict timeout (default: 5000ms) to prevent process stalling.
