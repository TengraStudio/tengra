# Theme System Migration Report

**Date**: 2026-01-23
**Status**: In Progress
**Target**: Full Dark/Light Mode Compatibility (Removal of hardcoded color classes)

## Executive Summary
The Tandem codebase currently relies heavily on hardcoded Tailwind classes (e.g., `bg-white`, `text-gray-300`, `bg-black/90`). To confirm full compliance with the new dual-theme system (Tandem White / Tandem Black), these must be migrated to semantic `index.css` variables (e.g., `bg-background`, `text-muted-foreground`).

**Total Estimated Work**: ~1-2 Hours
**Priority**: Medium (Fixes invisible text in Light Mode)

---

## 1. Core Structural Components
*Estimated Time: 15 mins*

These components define the application shell. Hardcoded colors here break the entire experience in Light Mode.

- [x] **`src/renderer/features/terminal/TerminalPanel.tsx`** (Migrated)
  - **Issue**: Uses `bg-zinc-950`, `bg-zinc-900/80` for headers and containers.
  - **Fix**: Migrate to `bg-background` / `bg-card`. Ensure xterm container matches xterm theme.
- [ ] **`src/renderer/views/ViewManager.tsx`**
  - **Issue**: Check for hardcoded backgrounds in motion containers.
  - **Fix**: Ensure `bg-background` is used for the main view wrapper.
- [ ] **`src/renderer/components/ui/SelectDropdown.tsx` & `LoggingDashboard.tsx`**
  - **Issue**: UI primitives using `text-zinc-*` and `bg-white`.
  - **Fix**: Standardize to `bg-popover` / `text-popover-foreground`.

## 2. Settings Module
*Estimated Time: 45 mins*

The settings module has the highest density of hardcoded values due to custom "cards" for statistics and models.

- [x] **Statistic Cards** (Cloud/Local/Antigravity/Codex) (Migrated)
  - `components/statistics/OverviewCards.tsx`
  - `components/statistics/AntigravityCard.tsx`
  - `components/statistics/ClaudeCard.tsx`
  - **Fix**: Replace `bg-white/5` with `bg-card`. Text `text-gray-400` -> `text-muted-foreground`.
- [x] **Tabs & Configuration** (Migrated)
  - `SettingsTabContent.tsx`, `GeneralTab.tsx`, `AdvancedTab.tsx`
  - `InstalledModelsList.tsx`
  - `PersonasTab.tsx`
  - **Fix**: These use `bg-black/20` or similar for form sections. Use `bg-muted/50`.

## 3. Projects Module
*Estimated Time: 20 mins*

Partially migrated, but specific sub-components remain hardcoded.

- [x] **IDE Components** (Migrated)
  - `ide/FolderInspector.tsx`: `text-white`, `bg-black`.
  - `ide/FileExplorer.tsx`: `text-gray-300`.
  - `ide/Terminal.tsx`: Fixed theme and container.
- [ ] **Workspace**
  - `WorkspaceToolbar.tsx`, `CommandStrip.tsx`, `CouncilPanel.tsx`
  - **Issue**: Toolbar backgrounds often hardcoded to `border-white/10`.
  - **Fix**: `border-border`.

## 4. Chat & Agent System
*Estimated Time: 20 mins*

- [ ] **Chat UI**
  - [x] `MessageBubble.tsx`: **CRITICAL**. Fixed.
  - [x] `ChatInput.tsx`: Fixed.
  - [ ] `GalleryView.tsx`: Image gallery backgrounds.
- [ ] **Agent Dashboard**
  - `AgentChatRoom.tsx`, `AgentDashboard.tsx`
  - Hardcoded darker themes that need to adapt to light mode (or verify if they should stay dark).

## 5. SSH & Networking
*Estimated Time: 10 mins*

- [ ] **SSH Components**
  - `SSHLogs.tsx`, `StatsDashboard.tsx`
  - These use hardcoded data visualization colors. Check if they need to be consistent with the theme or if they are "terminal-like" (always dark).

---

## Migration Plan

1.  **Refactor CSS Configuration**: Ensure `index.css` has `hsl()` variables for all required shades (`muted`, `card`, `popover`, `accent`).
2.  **Batch Replace**:
    - `border-white/5` -> `border-border`
    - `bg-white/5` -> `bg-white/5` (if overlay) OR `bg-accent/50` (if interactive).
    - `text-gray-300` / `text-zinc-400` -> `text-muted-foreground`.
    - `bg-black` / `bg-zinc-950` -> `bg-background` or `bg-card`.
3.  **Component-Level Fixes**: Manually adjust `MessageBubble` and `TerminalPanel`.

**Total Estimated Effort**: ~1.5 Hours to complete full migration.
