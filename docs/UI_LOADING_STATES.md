# UI Loading States

## Overview

The loading system is centralized with analytics and cancellation support.

- Core component: `src/renderer/components/ui/LoadingState.tsx`
- Skeleton catalog: `src/renderer/components/ui/view-skeletons.tsx`
- Analytics store: `src/renderer/store/loading-analytics.store.ts`

## Features

- Consistent spinner and status messaging.
- Optional progress bar and estimated remaining time.
- Optional cancellation button for long-running operations.
- Operation-level analytics (`started`, `completed`, `cancelled`, `failed`, average duration).
- View-specific skeleton placeholders used by `ViewManager` suspense fallbacks.

## Usage

```tsx
<LoadingState
  message="Loading project analysis"
  stage="Indexing workspace"
  operationId="project-analysis"
  analyticsContext="projects"
  startedAt={Date.now()}
  estimatedMs={15000}
  progress={42}
  onCancel={cancelFn}
/>
```

