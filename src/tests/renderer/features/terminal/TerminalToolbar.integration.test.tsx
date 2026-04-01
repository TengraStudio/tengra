import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
        availableShells: [{ id: 'bash', name: 'Bash', path: '/bin/bash' }],
        selectableBackends: [{ id: 'integrated', name: 'Integrated', available: true }],
        integratedBackend: { id: 'integrated', name: 'Integrated', available: true },
        launchableExternalBackends: [{ id: 'external-a', name: 'External A', available: true }],
        defaultBackendName: 'Integrated',
        resolvedDefaultBackendId: 'integrated',
        persistPreferredBackendId: vi.fn().mockResolvedValue(undefined),
        createTerminal: vi.fn(),
        resolvePreferredShellId: vi.fn().mockReturnValue('bash'),
        t: (key: string) => key,
        isLoadingRemoteConnections: false,
        remoteSshProfiles: [
            {
                id: 'ssh-1',
                name: 'Prod',
                host: 'prod.example.com',
                port: 22,
                username: 'root',
            },
        ],
        remoteDockerContainers: [
            {
                id: 'docker-1',
                name: 'api',
                status: 'running',
                shell: '/bin/sh',
            },
        ],
        hasRemoteConnections: true,
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
        hasActiveSession: true,
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

describe('TerminalToolbar integration flows', () => {
    it('persists preferred backend selection when backend entry is clicked', async () => {
        const user = userEvent.setup();
        const persistPreferredBackendId = vi.fn().mockResolvedValue(undefined);

        render(
            <TerminalToolbar
                {...createBaseProps()}
                persistPreferredBackendId={persistPreferredBackendId}
            />
        );

        await user.click(screen.getByText('Integrated'));

        expect(persistPreferredBackendId).toHaveBeenCalledWith('integrated');
    });

    it('creates integrated terminal sessions from shell selection', async () => {
        const user = userEvent.setup();
        const createTerminal = vi.fn();

        render(<TerminalToolbar {...createBaseProps()} createTerminal={createTerminal} />);

        await user.click(screen.getByRole('button', { name: /Bash/ }));

        expect(createTerminal).toHaveBeenCalledWith('bash', 'integrated');
    });

    it('does not launch external backend when preferred shell resolution fails', async () => {
        const user = userEvent.setup();
        const createTerminal = vi.fn();
        const resolvePreferredShellId = vi.fn().mockReturnValue(null);

        render(
            <TerminalToolbar
                {...createBaseProps()}
                createTerminal={createTerminal}
                resolvePreferredShellId={resolvePreferredShellId}
            />
        );

        await user.click(screen.getByRole('button', { name: /External A/i }));

        expect(resolvePreferredShellId).toHaveBeenCalledTimes(1);
        expect(createTerminal).not.toHaveBeenCalledWith(expect.any(String), 'external-a');
    });

    it('creates remote terminals for SSH and Docker entries', async () => {
        const user = userEvent.setup();
        const createRemoteTerminal = vi.fn();

        render(
            <TerminalToolbar
                {...createBaseProps()}
                createRemoteTerminal={createRemoteTerminal}
            />
        );

        await user.click(screen.getByRole('button', { name: /Prod/i }));
        await user.click(screen.getByRole('button', { name: /api/i }));

        expect(createRemoteTerminal).toHaveBeenNthCalledWith(1, {
            kind: 'ssh',
            profile: {
                id: 'ssh-1',
                name: 'Prod',
                host: 'prod.example.com',
                port: 22,
                username: 'root',
            },
        });
        expect(createRemoteTerminal).toHaveBeenNthCalledWith(2, {
            kind: 'docker',
            container: {
                id: 'docker-1',
                name: 'api',
                status: 'running',
                shell: '/bin/sh',
            },
        });
    });
});
