# Animation System Guide

## Presets

Animation timing presets are defined in:

- `src/renderer/lib/animation-system.ts`

Available presets:

- `micro`
- `default`
- `emphasized`
- `page`
- `tooltip`

Each preset maps to duration + easing values and respects reduced motion settings.

## Reduced Motion

- Uses `prefers-reduced-motion`.
- Optional forced mode via local storage key: `tandem.motion.force-reduced=true`.

## Analytics and Debug

Animation usage analytics are tracked in:

- `src/renderer/store/animation-analytics.store.ts`

Developer tools:

- Toggle animation debug mode from `DeveloperTab`.
- View play counts and reduced-motion play counts.

