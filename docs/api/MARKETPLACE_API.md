# Marketplace API Reference

This document defines the high-level API and IPC contracts available for extensions and for managing extensions within the Tengra host app.

## Extension Lifecycle API

Extensions are managed by the `ExtensionService`. The following IPC channels are used by the renderer to interact with the service.

### `extension:get-all`
Returns a list of all installed extensions and their current status.
- **Returns**: `{ success: boolean; extensions: Array<{ manifest: ExtensionManifest; status: ExtensionStatus }> }`

### `extension:get`
Returns a single extension by ID.
- **Args**: `extensionId: string`
- **Returns**: `{ success: boolean; extension?: { manifest: ExtensionManifest; status: ExtensionStatus } }`

### `extension:activate`
Manually triggers activation for an extension.
- **Args**: `extensionId: string`
- **Returns**: `{ success: boolean; error?: string }`

### `extension:deactivate`
Deactivates an active extension.
- **Args**: `extensionId: string`
- **Returns**: `{ success: boolean; error?: string }`

## Extension Context

When an extension is activated, it receives an `ExtensionContext` object. This object provides the necessary bridge back to the host app.

```typescript
interface ExtensionContext {
    extensionId: string;
    extensionPath: string;
    globalState: Memento;     // Persists across restarts
    workspaceState: Memento;  // Persists per workspace
    subscriptions: Disposable[]; // Cleaned up on deactivation
    logger: Logger;           // Scoped logging (to appLogger)
    configuration: ConfigAccessor; // Read/write extension settings
}
```

## Manifest Schema (`extension.json` or `package.json > tengra`)

The following fields are mandatory or highly recommended:

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier (kebab-case). |
| `name` | `string` | Human-readable name. |
| `version` | `string` | SEMVER version. |
| `main` | `string` | Path to the compiled entry file relative to root. |
| `capabilities` | `string[]` | Types: `theme`, `mcp`, `agent`, `command`, `ui`. |
| `activationEvents` | `string[]` | e.g., `onCommand:someCmd`, `onLanguage:typescript`, or `*`. |

## Development IPC

Channels specifically for dev-mode:

- `extension:dev-start`: Loads an extension from a local directory.
- `extension:dev-stop`: Disables dev mode for an entry.
- `extension:dev-reload`: Force reloads the logic from disk.
- `extension:validate`: Runs the manifest through the internal validator.
