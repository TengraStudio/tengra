import {
    __resetUiLayoutStoreForTests,
    exportUiLayoutState,
    getUiLayoutSnapshot,
    importUiLayoutState,
    sanitizeUiLayoutState,
    setAppShellState,
    setWorkspaceShellState,
} from '@renderer/store/ui-layout.store';
import { beforeEach, describe, expect, it } from 'vitest';

describe('ui layout store', () => {
    beforeEach(() => {
        __resetUiLayoutStoreForTests();
    });

    it('migrates legacy payloads that only contain activity bar data', () => {
        const migrated = sanitizeUiLayoutState({
            activityBar: {
                activeItem: 'projects',
                collapsed: true,
            },
        });

        expect(migrated.activityBar.activeItem).toBe('projects');
        expect(migrated.activityBar.collapsed).toBe(true);
        expect(migrated.appShell.sidebarCollapsed).toBe(false);
        expect(migrated.workspaceShell.terminalHeight).toBe(250);
    });

    it('validates imported shell dimensions with bounds', () => {
        importUiLayoutState({
            appShell: { sidebarCollapsed: true },
            workspaceShell: {
                sidebarCollapsed: true,
                agentPanelWidth: 9999,
                terminalHeight: 10,
            },
        });

        const snapshot = getUiLayoutSnapshot();
        expect(snapshot.appShell.sidebarCollapsed).toBe(true);
        expect(snapshot.workspaceShell.sidebarCollapsed).toBe(true);
        expect(snapshot.workspaceShell.agentPanelWidth).toBe(640);
        expect(snapshot.workspaceShell.terminalHeight).toBe(150);
    });

    it('exports current state snapshots', () => {
        setAppShellState({ sidebarCollapsed: true });
        setWorkspaceShellState({ terminalHeight: 420 });

        const exported = exportUiLayoutState();
        expect(exported.state.appShell.sidebarCollapsed).toBe(true);
        expect(exported.state.workspaceShell.terminalHeight).toBe(420);
        expect(exported.state.version).toBe(2);
    });
});
