# Quick Wins (Fast-Makeable)

> Extracted from TODO.md — remaining tasks only

## Pending Quick Wins

- [x] `src/renderer/features/settings/components/ImageSettingsTab.tsx`
- [x] Extracted logic to `useImageSettingsHandlers` hook. Line count reduced by 65%.

## Refactor Oversized Legacy Functions (AUD-2026-02-20-08)

- [x] `src/renderer/features/projects/hooks/useAgentHandlers.ts` (Verified: within limits)
- [x] `src/renderer/features/projects/hooks/useWorkspaceManager.ts` (Refactored: extracted `useMountManagement`)
- [x] `src/renderer/features/projects/utils/workspace-mount-validation.ts` (Verified: within limits)
- [x] `src/shared/utils/extension.util.ts` (Refactored: split `validateManifest`)

## Other Quick Wins

- [ ] **AUD-2026-02-20-06**: Resolve npm audit backlog (39 vulnerabilities: 35 high / 4 moderate) via phased dependency upgrades (`electron-builder`, `eslint`, `@electron/rebuild`, `typescript-eslint`).
- [ ] **AUD-2026-02-20-07**: Investigate `npm run build` timeout in CI/dev shell and document stable timeout/memory settings for local and GitHub Actions.
