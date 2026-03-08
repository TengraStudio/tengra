import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('workspace/workflow renderer entrypoint compatibility shims', () => {
    const root = process.cwd();
    const read = (relativePath: string): string =>
        fs.readFileSync(path.join(root, relativePath), 'utf-8').replace(/\r\n/g, '\n').trim();

    it('keeps WorkspacesPage shim bound to WorkspacePage', () => {
        const content = read('src/renderer/features/workspace/WorkspacesPage.tsx');
        expect(content).toContain("export { WorkspacesPage as WorkspacesPage } from './WorkspacePage';");
        expect(content).toContain("export * from './WorkspacePage';");
    });

    it('keeps WorkspaceCard entrypoint exporting the canonical component', () => {
        const content = read('src/renderer/features/workspace/components/WorkspaceCard.tsx');
        expect(content).toContain('export const WorkspaceCard');
    });

    it('keeps VirtualizedWorkspaceGrid entrypoint exporting the canonical component', () => {
        const content = read('src/renderer/features/workspace/components/VirtualizedWorkspaceGrid.tsx');
        expect(content).toContain('export const VirtualizedWorkspaceGrid');
    });

    it('keeps WorkspaceAgentTab shim bound to AutomationWorkflowTab entrypoint', () => {
        const content = read('src/renderer/features/workspace/components/WorkspaceAgentTab.tsx');
        expect(content).toBe("export * from './AutomationWorkflowTab';");
    });
});
