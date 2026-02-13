# Responsive Design Guide

## Breakpoint Management

Breakpoint utilities are centralized in:

- `src/renderer/lib/responsive.ts`

Supported breakpoints:

- `mobile` `< 640`
- `tablet` `640-1023`
- `desktop` `1024-1439`
- `wide` `>= 1440`

## Analytics

Responsive transitions and viewport counters are tracked in:

- `src/renderer/store/responsive-analytics.store.ts`

The app records breakpoint changes from `App.tsx`, including viewport dimensions.

## Runtime Behavior

- Mobile breakpoint auto-collapses the main sidebar.
- Layout sizing adapts in `LayoutManager` and notification panel placement.

