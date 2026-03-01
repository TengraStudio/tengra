# Keyboard Shortcuts Reference

## Global Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl/Cmd+K` | Open Command Palette | Global |
| `Ctrl/Cmd+N` | New Chat | Global |
| `Ctrl/Cmd+,` | Open Settings | Global |
| `Ctrl/Cmd+L` | Clear Chat | Chat view |
| `Ctrl/Cmd+B` | Toggle Sidebar | Global |
| `Shift+?` | Show Keyboard Shortcuts | Global |

## Navigation

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl/Cmd+1` | Go to Chat | Global |
| `Ctrl/Cmd+2` | Go to Projects | Global |
| `Ctrl/Cmd+4` | Go to Settings | Global |

## Editing

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl/Cmd+Z` | Undo | Editor |
| `Ctrl/Cmd+Y` | Redo | Editor |
| `Alt+E` | Explain selection | Chat/Editor |
| `Alt+T` | Translate selection | Chat/Editor |
| `Alt+C` | Copy to clipboard | Chat/Editor |

## Terminal — Default Preset

| Shortcut | Action | Context |
|----------|--------|---------|
| `` Ctrl+` `` | Toggle Terminal Panel | Global |
| `` Ctrl+Shift+` `` | New Terminal Tab | Terminal |
| `Ctrl+W` | Close Terminal Tab | Terminal |
| `Ctrl+F` | Search in Terminal | Terminal |
| `Ctrl+\` | Split Terminal | Terminal |
| `Ctrl+Shift+D` | Detach Terminal | Terminal |

## Terminal — Vim Preset

| Shortcut | Action | Context |
|----------|--------|---------|
| `` Ctrl+` `` | Toggle Terminal Panel | Global |
| `` Ctrl+Shift+` `` | New Terminal Tab | Terminal |
| `Ctrl+W` | Close Terminal Tab | Terminal |
| `Ctrl+/` | Search in Terminal | Terminal |
| `Ctrl+\` | Split Terminal | Terminal |
| `Ctrl+Shift+D` | Detach Terminal | Terminal |

## Terminal — Emacs Preset

| Shortcut | Action | Context |
|----------|--------|---------|
| `` Ctrl+` `` | Toggle Terminal Panel | Global |
| `Ctrl+Shift+T` | New Terminal Tab | Terminal |
| `Ctrl+W` | Close Terminal Tab | Terminal |
| `Ctrl+S` | Search in Terminal | Terminal |
| `Ctrl+\` | Split Terminal | Terminal |
| `Ctrl+Shift+D` | Detach Terminal | Terminal |

## Customization

Keyboard shortcuts are configurable and stored in `localStorage` under key `app.keyboard-shortcuts.v1`. Terminal shortcut presets can be switched in Settings → Terminal.

Source files:
- `src/renderer/hooks/shortcutBindings.ts` — global shortcuts
- `src/renderer/features/terminal/utils/shortcut-config.ts` — terminal presets
