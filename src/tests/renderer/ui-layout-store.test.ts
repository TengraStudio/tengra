import {
    __resetUiLayoutStoreForTests,
    exportUiLayoutState,
    getUiLayoutSnapshot,
    importUiLayoutState,
    sanitizeUiLayoutState,
    setAppShellState,
    setProjectShellState,
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
        expect(migrated.projectShell.terminalHeight).toBe(250);
    });

    it('validates imported shell dimensions with bounds', () => {
        importUiLayoutState({
            appShell: { sidebarCollapsed: true },
            projectShell: {
                sidebarCollapsed: true,
                agentPanelWidth: 9999,
                terminalHeight: 10,
            },
        });

        const snapshot = getUiLayoutSnapshot();
        expect(snapshot.appShell.sidebarCollapsed).toBe(true);
        expect(snapshot.projectShell.sidebarCollapsed).toBe(true);
        expect(snapshot.projectShell.agentPanelWidth).toBe(640);
        expect(snapshot.projectShell.terminalHeight).toBe(150);
    });

    it('exports current state snapshots', () => {
        setAppShellState({ sidebarCollapsed: true });
        setProjectShellState({ terminalHeight: 420 });

        const exported = exportUiLayoutState();
        expect(exported.state.appShell.sidebarCollapsed).toBe(true);
        expect(exported.state.projectShell.terminalHeight).toBe(420);
        expect(exported.state.version).toBe(2);
    });
});
