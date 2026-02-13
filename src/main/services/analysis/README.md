# Analysis Services Module

This module provides runtime diagnostics and performance analysis for the main process.

## Services

- `performance.service.ts`: memory trend sampling, leak heuristics, GC hints, dashboard payloads
- `memory-profiling.service.ts`: snapshot-based memory profiling
- `model-analytics.service.ts`: model usage analytics aggregation
- `monitoring.service.ts`: CPU/memory usage signals for operational checks

## Operational Notes

- Services are designed to run continuously with bounded in-memory history.
- Metrics are exposed via IPC for renderer dashboards and scripts.
- Alerts should be actionable and low-noise; avoid logging duplicate warnings repeatedly.

