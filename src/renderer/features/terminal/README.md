# Terminal Modules

This feature is split into a small module surface to keep `TerminalPanel.tsx` focused on orchestration:

- `TerminalPanel.tsx` (`terminal-manager`): owns tab state, split layout state, search UI state, and command dispatch.
- `components/TerminalInstance.tsx`: owns xterm lifecycle, backend session creation, renderer resize, and link activation.
- `components/TerminalTabsBar.tsx`: isolated tab list rendering and drag/drop interactions.
- `components/TerminalContextMenu.tsx`: right-click action menu for copy/paste/search/split helpers.
- `components/TerminalEmptyState.tsx`: empty terminal placeholder UI.
- `utils/*`: shared parser/validator/state helpers used by panel + tests.

## Module Versioning

Terminal module compatibility is tracked in `utils/module-version.ts`.

- `TERMINAL_MODULE_VERSION`: current semantic version of the modular terminal stack.
- `serializeTerminalModuleVersion()`: stable string form for telemetry/debug.
- `isTerminalModuleVersionCompatible()`: major-version compatibility check.

`TerminalPanel.tsx` publishes the current module version via:

- `data-terminal-module="terminal-manager"`
- `data-terminal-module-version="<semver>"`

## Testing

Renderer tests covering extracted modules:

- `src/tests/renderer/terminal-split-config.test.ts`
- `src/tests/renderer/terminal-shortcut-config.test.ts`
- `src/tests/renderer/terminal-session-registry.test.ts`
- `src/tests/renderer/terminal-search-utils.test.ts`
- `src/tests/renderer/terminal-module-version.test.ts`
