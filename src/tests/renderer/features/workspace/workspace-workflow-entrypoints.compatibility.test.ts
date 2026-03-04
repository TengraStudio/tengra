import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('workspace/workflow renderer entrypoint compatibility shims', () => {
    const root = process.cwd();
    const read = (relativePath: string): string =>
        fs.readFileSync(path.join(root, relativePath), 'utf-8').replace(/\r\n/g, '\n').trim();

    it('keeps ProjectsPage shim bound to WorkspacesPage', () => {
        const content = read('src/renderer/features/workspace/ProjectsPage.tsx');
        expect(content).toContain("export { WorkspacesPage as ProjectsPage } from './WorkspacePage';");
    });

    it('keeps ProjectCard shim bound to WorkspaceCard canonical entrypoint', () => {
        const content = read('src/renderer/features/workspace/components/ProjectCard.tsx');
        expect(content).toContain("export { ProjectCard } from './WorkspaceCard';");
        expect(content).toContain("export * from './WorkspaceCard';");
    });

    it('keeps VirtualizedProjectGrid shim exports bound to workspace canonical exports', () => {
        const content = read('src/renderer/features/workspace/components/VirtualizedProjectGrid.tsx');
        expect(content).toContain("export { default } from './VirtualizedWorkspaceGrid';");
        expect(content).toContain("export * from './VirtualizedWorkspaceGrid';");
    });

    it('keeps ProjectAgentTab shim bound to AutomationWorkflowTab entrypoint', () => {
        const content = read('src/renderer/features/workspace/components/ProjectAgentTab.tsx');
        expect(content).toBe("export * from './AutomationWorkflowTab';");
    });
});
