# Technical Debt & Internationalization

> Extracted from TODO.md — remaining tasks only

## Architecture

- ( ) **DEBT-01**: Migrate to React Server Components
  - ( ) Evaluate feasibility for Electron
  - ( ) Identify components for migration
  - ( ) Performance benchmarking

## Internationalization

- ( ) Audit missing keys in all language files
- ( ) Add context comments for translators
- ( ) Implement translation memory

## Project Health & Maintenance (Backlog 0503–0506)

- ( ) **BACKLOG-0503**: Modularize Preload Script: Split the oversized `src/main/preload.ts` into modular fragments within `src/main/preload/`.
- ( ) **BACKLOG-0504**: Enforce Component Promotion Rules: Perform cleanup of feature-local components in `src/renderer/features`.
- ( ) **BACKLOG-0505**: Root Directory Hygiene: Move `tengra_key.txt` to `.env` or secure storage.
- ( ) **BACKLOG-0506**: Build Artifact Hygiene: Move `stats.html` generation to `dist/` or `build/`.
