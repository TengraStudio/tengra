# Terminal Module Usage Examples

## 1) Render the terminal manager

```tsx
<TerminalPanel
  isOpen={isTerminalOpen}
  workspacePath={workspacePath}
  hideTerminalPanel={() => setTerminalOpen(false)}
  onToggle={() => setTerminalOpen(prev => !prev)}
/>
```

## 2) Reuse terminal search helper in isolated tests/tools

```ts
const result = collectTerminalSearchMatches(
  ['npm run build', 'build failed'],
  'build',
  { useRegex: false, maxMatches: 100 }
);
```

## 3) Read module version for diagnostics

```ts
const version = serializeTerminalModuleVersion();
const compatible = isTerminalModuleVersionCompatible('2.3.1');
```
