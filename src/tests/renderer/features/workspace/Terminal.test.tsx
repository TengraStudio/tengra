/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TerminalComponent } from '@/features/workspace/components/ide/Terminal';

// Mock xterm
vi.mock('@xterm/xterm', () => {
    return {
        Terminal: class {
            loadAddon = vi.fn();
            open = vi.fn();
            onData = vi.fn();
            onResize = vi.fn();
            write = vi.fn();
            dispose = vi.fn();
            cols = 80;
            rows = 24;
        },
    };
});

// Mock FitAddon
vi.mock('@xterm/addon-fit', () => {
    return {
        FitAddon: class {
            fit = vi.fn();
        },
    };
});

// Mock i18n
vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe('TerminalComponent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Mock electron APIs
        window.electron = {
            terminal: {
                create: vi.fn().mockResolvedValue('session-1'),
                write: vi.fn().mockResolvedValue(undefined),
                resize: vi.fn().mockResolvedValue(undefined),
                kill: vi.fn().mockResolvedValue(undefined),
                onData: vi.fn().mockReturnValue(vi.fn()),
                onExit: vi.fn().mockReturnValue(vi.fn()),
                getRuntimeHealth: vi.fn().mockResolvedValue({
                    terminalAvailable: true,
                    availableBackends: 2,
                    totalBackends: 3,
                }),
                getDockerContainers: vi.fn().mockResolvedValue([]),
            },
            ssh: {
                getConnections: vi.fn().mockResolvedValue([]),
            },
        } as any;
        
        // Mock localStorage
        Storage.prototype.getItem = vi.fn();
        Storage.prototype.setItem = vi.fn();
    });

    it('renders terminal status indicators', async () => {
        render(<TerminalComponent workspaceId="workspace-1" />);

        await waitFor(() => {
            expect(screen.getByText(/frontend.workspace.terminalStatusTerm 2\/3/i)).toBeInTheDocument();
            expect(screen.getByText(/frontend.workspace.terminalStatusSsh 0/i)).toBeInTheDocument();
            expect(screen.getByText(/frontend.workspace.terminalStatusDocker/i)).toBeInTheDocument();
        });
    });

    it('initializes xterm and fit addon on mount', async () => {
        render(<TerminalComponent workspaceId="workspace-1" />);

        await waitFor(() => {
            expect(window.electron.terminal.create).toHaveBeenCalled();
        });
    });

    it('handles runtime health updates', async () => {
        window.electron.terminal.getRuntimeHealth = vi.fn().mockResolvedValue({
            terminalAvailable: false,
            availableBackends: 0,
            totalBackends: 3,
        });

        render(<TerminalComponent workspaceId="workspace-1" />);

        await waitFor(() => {
            expect(screen.getByText(/frontend.workspace.terminalStatusTerm 0\/3/i)).toBeInTheDocument();
        });
    });

    it('handles SSH connection count', async () => {
        window.electron.ssh.getConnections = vi.fn().mockResolvedValue([
            { id: 'conn-1' },
            { id: 'conn-2' }
        ]);

        render(<TerminalComponent workspaceId="workspace-1" />);

        await waitFor(() => {
            expect(screen.getByText(/frontend.workspace.terminalStatusSsh 2/i)).toBeInTheDocument();
        });
    });
});

