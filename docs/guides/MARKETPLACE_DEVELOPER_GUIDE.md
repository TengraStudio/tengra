# Marketplace Developer Guide

This guide will help you build, test, and publish extensions for the Tengra Marketplace.

## What are Extensions?

Extensions allow you to add new capabilities to Tengra. You can create themes, new agent personas, MCP servers, or even entire new UI panels.

## Getting Started

### 1. Prerequisites

- **Node.js**: Version 18 or higher.
- **TypeScript**: Extensions are strictly typed.
- **Tengra SDK**: (Coming soon) Use the built-in IPC channels for now.

### 2. The Manifest (`package.json`)

Every extension is essentially a specialized Node.js package. The core configuration lives under the `tengra` key in your `package.json`.

```json
{
  "name": "my-cool-theme",
  "version": "1.0.0",
  "tengra": {
    "id": "my-cool-theme",
    "name": "My Cool Theme",
    "description": "A very dark and sleek theme for Tengra.",
    "main": "./dist/index.js",
    "license": "MIT",
    "author": {
      "name": "Your Name"
    },
    "capabilities": ["theme"],
    "activationEvents": ["*"]
  }
}
```

### 3. Extension Lifecycle

- **Activation**: Triggered by `activationEvents`. The app calls your `activate` function.
- **Deactivation**: Triggered when the extension is disabled or the app closes. The app calls your `deactivate` function.

### 4. Development Workflow

1. **Setup**: Create your project and point to your entry file in the manifest.
2. **Local Testing**:
   - Use the `extension:dev-start` IPC channel to load your local folder.
   - Use `extension:dev-reload` to apply changes without restarting the app.
3. **Linting**: No `any` types are allowed. Use the project's strict linting rules.

## Best Practices

- **NASA Power of Ten**: Keep your functions under 60 lines.
- **Type Safety**: Avoid `any` and `unknown`. Use strictly defined interfaces.
- **Cleanup**: Always use the `subscriptions` array in `ExtensionContext` to dispose of resources (event listeners, intervals, etc.) during deactivation.
- **i18n**: Never hardcode user-facing strings. Use the provided translation utilities.

## Publishing

Currently, publishing is handled through the `/submit` endpoint of the Marketplace API by providing a GitHub URL for manual review. Check the [Marketplace System](../tasks/marketplace-system.md) documentation for more details.
