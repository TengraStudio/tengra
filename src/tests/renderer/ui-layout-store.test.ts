/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { WORKSPACE_COMPAT_ALIAS_VALUES } from '@shared/constants';
import { beforeEach, describe, expect, it } from 'vitest';

import {
    __resetUiLayoutStoreForTests,
    exportUiLayoutState,
    getUiLayoutSnapshot,
    getWorkspaceShellState,
    importUiLayoutState,
    sanitizeUiLayoutState,
    setAppShellState,
    setWorkspaceShellState,
} from '@/store/ui-layout.store';

describe('ui layout store', () => {
    beforeEach(() => {
        __resetUiLayoutStoreForTests();
    });

    it('migrates legacy payloads that only contain activity bar data', () => {
        const migrated = sanitizeUiLayoutState({
            activityBar: {
                activeItem: WORKSPACE_COMPAT_ALIAS_VALUES.PLURAL,
                collapsed: true,
            },
        });

        expect(migrated.activityBar.activeItem).toBe(WORKSPACE_COMPAT_ALIAS_VALUES.PLURAL);
        expect(migrated.activityBar.collapsed).toBe(true);
        expect(migrated.appShell.sidebarCollapsed).toBe(false);
        expect(migrated.workspaceShell.terminalHeight).toBe(250);
    });

    it('validates imported shell dimensions with bounds', () => {
        importUiLayoutState({
            appShell: { sidebarCollapsed: true },
            workspaceShell: {
                sidebarCollapsed: true,
                showAgentPanel: true,
                agentPanelWidth: 9999,
                showTerminal: true,
                terminalHeight: 10,
                terminalFloating: true,
                terminalMaximized: true,
            },
        });

        const snapshot = getUiLayoutSnapshot();
        expect(snapshot.appShell.sidebarCollapsed).toBe(true);
        expect(snapshot.workspaceShell.sidebarCollapsed).toBe(true);
        expect(snapshot.workspaceShell.showAgentPanel).toBe(true);
        expect(snapshot.workspaceShell.agentPanelWidth).toBe(640);
        expect(snapshot.workspaceShell.showTerminal).toBe(true);
        expect(snapshot.workspaceShell.terminalHeight).toBe(150);
        expect(snapshot.workspaceShell.terminalFloating).toBe(true);
        expect(snapshot.workspaceShell.terminalMaximized).toBe(true);
    });

    it('exports current state snapshots', () => {
        setAppShellState({ sidebarCollapsed: true });
        setWorkspaceShellState({ terminalHeight: 420 });

        const exported = exportUiLayoutState();
        expect(exported.state.appShell.sidebarCollapsed).toBe(true);
        expect(exported.state.workspaceShell.terminalHeight).toBe(420);
        expect(exported.state.version).toBe(3);
    });

    it('persists isolated workspace layout profiles', () => {
        setWorkspaceShellState('workspace-a', {
            sidebarCollapsed: true,
            showTerminal: true,
            terminalHeight: 480,
        });
        setWorkspaceShellState('workspace-b', {
            showAgentPanel: true,
            agentPanelWidth: 420,
        });

        expect(getWorkspaceShellState('workspace-a')).toMatchObject({
            sidebarCollapsed: true,
            showTerminal: true,
            terminalHeight: 480,
            showAgentPanel: false,
        });
        expect(getWorkspaceShellState('workspace-b')).toMatchObject({
            sidebarCollapsed: false,
            showAgentPanel: true,
            agentPanelWidth: 420,
            showTerminal: false,
        });
    });
});
