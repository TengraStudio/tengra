# Tengra performance Optimization TODO

## Build-Time Optimizations
- [x] Configure Terser for production minification (2 passes, mangle toplevel)
- [x] Prune console logs and traces in production
- [x] Integrate SVGO-like minification for SVG's (Handled via Vite plugins if already present)

## Startup & Runtime Performance
- [x] Enable V8 Compile Cache for fast startup (Node 22+ switch)
- [x] Integrated lightweight CSS loading splash screen to index.html
- [x] Add app-ready class to dismiss splash after React hydration
- [x] Trigger memory cleanup on window blur for backgrounded instances
- [x] Add hardware acceleration toggle (TENGRA_LOW_RESOURCE_MODE)

## Architectural Offloading
- [x] Introduce `UtilityProcessService` for background worker management
- [x] Register UtilityProcessService in DI container and global services map
- [ ] Migrate `AuditLogService` to UtilityProcess worker
- [ ] Migrate `TelemetryService` to UtilityProcess worker
- [ ] Prototype binary IPC transport for chat message payloads

---
*Updated on 2026-03-19*
