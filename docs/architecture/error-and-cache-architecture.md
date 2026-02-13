# Error And Cache Architecture

## Error Handling

- Shared error primitives live in `src/shared/utils/error.util.ts`.
- Renderer-side handling uses `src/renderer/utils/error-handler.util.ts`.
- Main-process typed errors live in `src/main/utils/error.util.ts`.

### Flow

1. Convert unknown failures into structured error objects (`getErrorMessage`, `toAppError`).
2. Map error code to recovery strategy (`getErrorRecoveryStrategy`).
3. Surface user-safe messages and optional recovery hints in UI.

### Recovery Strategy Model

- `retry`: transient failures (network/internal)
- `reauthenticate`: auth/session failures
- `check-input`: validation failures
- `contact-support`: unknown/non-actionable failures

## Caching

- Base cache primitive: `Cache<T>` with TTL + LRU + analytics counters.
- Multi-level cache: `MultiLevelCache<T>` with hot and warm layers.
- Global snapshot: `getCacheAnalyticsSnapshot()` for observability.

### Cache Lifecycle

1. Warm startup caches with deterministic fallback data.
2. Serve reads from hot cache first, then warm cache.
3. Promote warm hits back to hot cache.
4. Track hit/miss/eviction/prune counters for tuning.

