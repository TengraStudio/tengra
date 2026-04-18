/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';

import { findExecutableInPath, findFirstExistingPath } from './backend-discovery.util';
import { ITerminalBackend, ITerminalProcess, TerminalCreateOptions } from './terminal-backend.interface';

/**
 * Terminal backend implementation for Alacritty.
 * 
 * Alacritty is a modern, cross-platform, GPU-accelerated terminal emulator.
 * This backend provides integration for Alacritty as an external terminal provider.
 */
export class AlacrittyBackend implements ITerminalBackend {
    public readonly id = 'alacritty';
    private alacrittyPath: string | null = null;
    private isDiscoveryDone = false;

    constructor() {
        // Discovery is lazy-loaded
    }

    /**
     * Check if Alacritty is available on the system
     */
    public async isAvailable(): Promise<boolean> {
        if (!this.isDiscoveryDone) {
            this.alacrittyPath = await this.discoverAlacrittyPath();
            this.isDiscoveryDone = true;
        }
        return this.alacrittyPath !== null;
    }

    /**
     * Create a new terminal session
     */
    public async create(options: TerminalCreateOptions): Promise<ITerminalProcess> {
        if (!this.isDiscoveryDone) {
            this.alacrittyPath = await this.discoverAlacrittyPath();
            this.isDiscoveryDone = true;
        }

        if (!this.alacrittyPath) {
            throw new Error('error.terminal.backend_not_found');
        }

        appLogger.info('AlacrittyBackend', `Opening Alacritty session: ${options.id}`);

        // Alacritty flags:
        // --working-directory <dir>
        // -e <command> [args...] 
        const args = [
            '--working-directory', options.cwd,
            '-e', options.shell,
            ...options.args
        ];

        let child: ChildProcess | null = null;
        try {
            child = spawn(this.alacrittyPath, args, {
                cwd: options.cwd,
                env: options.env as NodeJS.ProcessEnv,
                detached: true,
                stdio: 'ignore'
            });

            child.unref();

            setTimeout(() => options.onData('\r\n[Alacritty window opened]\r\n'), 100);

            child.on('exit', (code) => {
                appLogger.info('AlacrittyBackend', `Alacritty process exited with code ${code}`);
                options.onExit(code ?? 0);
            });

        } catch (error) {
            appLogger.error('AlacrittyBackend', 'Failed to spawn Alacritty', error as Error);
            throw error;
        }

        return {
            write: (_data: string) => {
                appLogger.info('AlacrittyBackend', 'External Alacritty window: input bridging not yet supported');
            },
            resize: (_cols: number, _rows: number) => {
                // Not applicable for external standalone window
            },
            kill: () => {
                if (child && !child.killed) {
                    child.kill();
                }
            }
        };
    }

    private async discoverAlacrittyPath(): Promise<string | null> {
        const discoveredPath = await findExecutableInPath('alacritty');
        if (discoveredPath) {
            appLogger.debug('AlacrittyBackend', `Found Alacritty at: ${discoveredPath}`);
            return discoveredPath;
        }

        appLogger.debug('AlacrittyBackend', 'Alacritty not found in PATH');

        const commonPaths = process.platform === 'win32'
            ? [
                'C:\\Program Files\\Alacritty\\alacritty.exe',
                path.join(process.env.LOCALAPPDATA ?? '', 'Alacritty', 'alacritty.exe')
            ]
            : [
                '/Applications/Alacritty.app/Contents/MacOS/alacritty',
                '/usr/local/bin/alacritty',
                '/usr/bin/alacritty'
            ];

        const commonPath = await findFirstExistingPath(commonPaths);
        if (commonPath) {
            appLogger.debug('AlacrittyBackend', `Found Alacritty at common location: ${commonPath}`);
            return commonPath;
        }

        return null;
    }
}
