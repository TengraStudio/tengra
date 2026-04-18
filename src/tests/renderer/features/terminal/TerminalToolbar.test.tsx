/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TerminalToolbar } from '@/features/terminal/components/TerminalToolbar';
import type { TerminalTab } from '@/types';

vi.mock('@/features/terminal/components/TerminalAppearanceModals', () => ({
    TerminalAppearanceModals: () => <div data-testid="terminal-appearance-modals" />,
}));

vi.mock('@/features/terminal/components/TerminalSplitControls', () => ({
    TerminalSplitControls: () => <div data-testid="terminal-split-controls" />,
}));

function createBaseProps(): ComponentProps<typeof TerminalToolbar> {
    const tabs: TerminalTab[] = [
        {
            id: 'tab-1',
            name: 'Terminal 1',
            type: 'terminal',
            status: 'idle',
            history: [],
            command: '',
        },
    ];

    return {
        tabs,
        activeTabId: 'tab-1',
        draggingTabId: null,
        dragOverTabId: null,
        handleTabSelect: vi.fn(),
        closeTab: vi.fn(),
        handleTabDragStart: vi.fn(),
        handleTabDragOver: vi.fn(),
        handleTabDrop: vi.fn(),
        resetTabDragState: vi.fn(),
        isNewTerminalMenuOpen: true,
        setIsNewTerminalMenuOpen: vi.fn(),
        isLoadingLaunchOptions: false,
        availableShells: [],
        selectableBackends: [],
        integratedBackend: undefined,
        launchableExternalBackends: [],
        defaultBackendName: 'Integrated',
        resolvedDefaultBackendId: undefined,
        persistPreferredBackendId: vi.fn().mockResolvedValue(undefined),
        createTerminal: vi.fn(),
        resolvePreferredShellId: vi.fn().mockReturnValue('bash'),
        t: (key: string) => key,
        isLoadingRemoteConnections: false,
        remoteSshProfiles: [],
        remoteDockerContainers: [],
        hasRemoteConnections: false,
        createRemoteTerminal: vi.fn(),
        isSplitPresetMenuOpen: false,
        setIsSplitPresetMenuOpen: vi.fn(),
        splitView: null,
        splitPresetOptions: [],
        splitAnalytics: {
            splitCreatedCount: 0,
            splitClosedCount: 0,
            splitOrientationToggleCount: 0,
            splitPresetApplyCount: 0,
            lastSplitActionAt: null,
        },
        isSynchronizedInputEnabled: false,
        saveCurrentSplitAsPreset: vi.fn(),
        applySplitPreset: vi.fn(),
        renameSplitPreset: vi.fn(),
        deleteSplitPreset: vi.fn(),
        resetSplitAnalytics: vi.fn(),
        toggleSynchronizedInput: vi.fn(),
        toggleSplitOrientation: vi.fn(),
        closeSplitView: vi.fn(),
        isGalleryView: false,
        toggleGalleryView: vi.fn(), 
        toggleSemanticPanel: vi.fn(),
        hasActiveSession: false,
        activeSemanticIssuesLength: 0,
        activeSemanticErrorCount: 0, 
        toggleRecording: vi.fn(),
        activeRecordingTabId: null,
        isMaximized: false,
        setIsMaximized: vi.fn(),
        onToggle: vi.fn(),
        appearanceProps: {
            inputRef: { current: null },
            onImport: vi.fn(),
            isAppearanceMenuOpen: false,
            setIsAppearanceMenuOpen: vi.fn(),
            title: 'Appearance',
            t: (key: string) => key,
            terminalAppearance: {
                themePresetId: 'default',
                fontPresetId: 'mono',
                ligatures: false,
                surfaceOpacity: 1,
                surfaceBlur: 0,
                cursorStyle: 'block',
                cursorBlink: false,
                fontSize: 14,
                lineHeight: 1.4,
                customTheme: null,
            },
            resolvedTerminalAppearance: {
                theme: {
                    background: '#111111',
                    foreground: '#eeeeee',
                    green: '#00ff00',
                    red: '#ff0000',
                    yellow: '#ffff00',
                },
                fontFamily: 'monospace',
                cursorStyle: 'block',
                cursorBlink: false,
                fontSize: 14,
                lineHeight: 1.4,
            },
            themePresets: [{ id: 'default', name: 'Default', category: 'default', theme: {} }],
            fontPresets: [{ id: 'mono', name: 'Monospace' }],
            cursorStyles: [{ id: 'block', name: 'Block' }],
            themeCategoryLabel: () => 'default',
            applyAppearancePatch: vi.fn(),
            exportAppearancePreferences: vi.fn(),
            openAppearanceImportDialog: vi.fn(),
            shortcutInputRef: { current: null },
            onShortcutImport: vi.fn(),
            shortcutPreset: 'default',
            applyShortcutPreset: vi.fn(),
            exportShortcutPreferences: vi.fn(),
            openShortcutImportDialog: vi.fn(),
            shareShortcutPreferences: vi.fn().mockResolvedValue(undefined),
            importShortcutShareCode: vi.fn(),
        },
    };
}

describe('TerminalToolbar edge cases', () => {
    it('shows a no-shells empty state when no shell is available', () => {
        render(<TerminalToolbar {...createBaseProps()} />);

        expect(screen.getByText('terminal.noShellsFound')).toBeInTheDocument();
    });

    it('shows loading state while launch options are loading', () => {
        render(
            <TerminalToolbar
                {...createBaseProps()}
                isLoadingLaunchOptions={true}
            />
        );

        expect(screen.getByText('common.loading')).toBeInTheDocument();
    });

    it('shows remote empty state when no remote connections exist', () => {
        render(
            <TerminalToolbar
                {...createBaseProps()}
                availableShells={[{ id: 'bash', name: 'Bash', path: '/bin/bash' }]}
            />
        );

        expect(
            screen.getByText('terminal.no_ssh_profiles / terminal.no_containers')
        ).toBeInTheDocument();
    });
 
});
