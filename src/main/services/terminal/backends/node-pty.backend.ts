/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';

import { ITerminalBackend, ITerminalProcess, TerminalCreateOptions } from './terminal-backend.interface';

// Type definitions for node-pty
interface IPty {
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    kill: () => void;
    onData: (callback: (data: string) => void) => void;
    onExit: (callback: (exitInfo: { exitCode: number }) => void) => void;
}

interface IPtyModule {
    spawn: (
        shell: string,
        args: string[],
        options: { name: string; cols: number; rows: number; cwd: string; env: Record<string, string | undefined> }
    ) => IPty;
}

/**
 * Terminal backend implementation using node-pty
 */
export class NodePtyBackend implements ITerminalBackend {
    public readonly id = 'node-pty';
    private ptyModule: IPtyModule | null = null;

    constructor() {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            this.ptyModule = require('node-pty') as IPtyModule;
        } catch {
            appLogger.warn('NodePtyBackend', 'node-pty not available');
        }
    }

    /**
     * Check if node-pty is available
     */
    public async isAvailable(): Promise<boolean> {
        return this.ptyModule !== null;
    }

    /**
     * Create a new terminal session using node-pty
     */
    public async create(options: TerminalCreateOptions): Promise<ITerminalProcess> {
        if (!this.ptyModule) {
            throw new Error('error.terminal.pty_not_available');
        }

        appLogger.debug('NodePtyBackend', `Spawning PTY: shell=${options.shell}, cwd=${options.cwd}, dims=${options.cols}x${options.rows}`);

        const ptyProcess = this.ptyModule.spawn(options.shell, options.args, {
            name: 'xterm-256color',
            cols: Math.max(1, options.cols),
            rows: Math.max(1, options.rows),
            cwd: options.cwd,
            env: options.env
        });

        // Wire up listeners
        ptyProcess.onData((data) => options.onData(data));
        ptyProcess.onExit(({ exitCode }) => options.onExit(exitCode));

        // Return process handle
        return {
            write: (data: string) => ptyProcess.write(data),
            resize: (cols: number, rows: number) => ptyProcess.resize(cols, rows),
            kill: () => ptyProcess.kill()
        };
    }
}
