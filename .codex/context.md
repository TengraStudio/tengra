# Project Context: Tandem (Orbit)

## Overview
Tandem is a high-performance desktop AI assistant built with Electron, React, and TypeScript. It features a multi-process architecture with a service-oriented backend and a strictly typed IPC bridge.

## Core Directives
1.  **Safety First**: NASA Power of Ten rules for control flow and memory.
2.  **Type Integrity**: Zero tolerance for `any` or `unknown`.
3.  **Clean Code**: Mandatory Boy Scout Rule for every edit.
4.  **Premium UX**: High-end aesthetics and performance optimizations.

## Directory Shortcuts
- `@main`: `src/main` (Main process)
- `@renderer`: `src/renderer` (UI layer)
- `@shared`: `src/shared` (Common types)
- `@docs`: `docs/` (Documentation)
- `@codex`: `.codex/` (AI-optimized context)

## Recent Shifts
- Documentation is now strictly mirrored to `.codex/`.
- Termination warnings have been added to all rule files to ensure absolute compliance.
- `LINT_ISSUES.md` introduced for systematic technical debt reduction.
