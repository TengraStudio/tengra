# Tooltip System Guide

## Overview

The tooltip system provides consistent styles, richer content, adaptive positioning, delays, and analytics.

- Component: `src/renderer/components/ui/tooltip.tsx`
- Positioning helpers: `src/renderer/components/ui/tooltip-utils.ts`
- Analytics store: `src/renderer/store/tooltip-analytics.store.ts`

## Features

- Shared visual style for all tooltip variants.
- Rich content support:
  - `title`
  - `content` (string or React node)
  - `description`
  - `shortcut`
- Positioning with viewport-aware fallback (`top`, `bottom`, `left`, `right`).
- Configurable open/close timing:
  - `delay`
  - `closeDelay`
- Tooltip interaction analytics (`shown`, `hidden`, per-tooltip counts, recent events).

## Usage

```tsx
<Tooltip
  id="settings-save"
  title="Save Settings"
  content="Persist current preferences"
  description="Writes preferences to local storage."
  shortcut="Ctrl+S"
  side="top"
  delay={250}
  closeDelay={90}
>
  <button>Save</button>
</Tooltip>
```
