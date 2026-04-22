# User and Troubleshooting Guide

This guide covers first-run setup, provider connection, workspaces, logs, and common recovery steps.

## First Run

On launch, Tengra checks the managed runtime and external dependencies before loading the full app. Required native components are stored under the managed runtime directory described in [MANAGED_RUNTIME.md](./MANAGED_RUNTIME.md).

If a blocking runtime issue is detected, the startup panel lets the user:

- refresh runtime status
- repair managed components
- open external install guidance
- start supported external dependencies such as Ollama

## Connecting Providers

Provider accounts are managed from Settings.

- Local models: install Ollama and pull models locally; Tengra detects the Ollama runtime and model list.
- OAuth providers: use the account linking flow in Settings.
- API-key providers: store credentials through the app UI; credentials are encrypted locally.
- Local image generation: SD-CPP can be used when available; configured fallback behavior is handled by the image settings/runtime layer.

Tengra is an unofficial client. Provider availability and model access depend on the user's account, region, subscription, and provider terms.

## Workspaces

Workspaces connect Tengra to local or remote projects.

- Local workspaces use filesystem, Git, terminal, and code intelligence services.
- Remote workspaces use SSH/SFTP flows where configured.
- Workspace-aware chat can use selected files, project context, terminal output, and tool evidence.

## Logs

Log locations depend on platform and packaging mode, but the useful categories are:

| Area | What To Check |
| --- | --- |
| Main process | service startup, IPC errors, proxy lifecycle |
| Renderer | UI errors through DevTools |
| Native proxy | provider routing, auth refresh, stream handling |
| Native DB/memory services | persistence and memory/runtime issues |
| Terminal/workspace | shell, SSH, Git, and LSP failures |

In development, start with the terminal running `npm run dev` and the app's main log output.

## Common Issues

### Managed Runtime Is Missing

Symptoms:

- startup gate blocks the app
- runtime status says `missing` or `install-required`
- native services do not start

Try:

1. Run `npm run build` in development to compile/copy native binaries.
2. Use the runtime repair action in the app if available.
3. Check [MANAGED_RUNTIME.md](./MANAGED_RUNTIME.md) for expected binary names and locations.

### Native Proxy Fails To Start

The active native proxy is `tengra-proxy`.

Try:

1. Check whether `tengra-proxy` exists in the managed runtime `bin` directory.
2. Run `npm run build` to refresh native binaries in development.
3. Check main-process logs for proxy startup and port binding errors.
4. Make sure another process is not occupying the configured proxy port.

### Provider Auth Or Model List Looks Stale

Try:

1. Refresh the account/model list in Settings.
2. Re-link the affected account.
3. Restart Tengra so the proxy and model registry reload account state.
4. Check native proxy logs for token refresh or upstream provider errors.

### Ollama Is Not Detected

Try:

1. Confirm Ollama is installed.
2. Confirm the Ollama server is running.
3. Visit or curl `http://127.0.0.1:11434/api/tags`.
4. Restart Tengra after installing Ollama.

### Database Or Workspace State Is Corrupted

Before deleting data, back up anything important.

Try:

1. Close Tengra fully.
2. Locate the platform app-data directory.
3. Back up the Tengra data directory.
4. Remove only the affected database/workspace cache if you know the failing area.
5. Restart Tengra.

## Developer Recovery Commands

```bash
npm run type-check
npm test
npm run lint
npm run secrets:scan
npm run audit:deps:gate
npm run build
```

If a native binary is locked on Windows, close the app and any leftover `tengra-*` processes, then rerun `npm run build`.
