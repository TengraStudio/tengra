import { ChildProcess, execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';

import { ITerminalBackend, ITerminalProcess, TerminalCreateOptions } from './terminal-backend.interface';

/**
 * Terminal backend implementation for Kitty.
 *
 * Kitty is a GPU-accelerated terminal emulator.
 * This backend opens Kitty as an external terminal window.
 */
export class KittyBackend implements ITerminalBackend {
    public readonly id = 'kitty';
    private kittyPath: string | null = null;
    private isDiscoveryDone = false;

    /**
     * Check if Kitty is available on the current system.
     */
    public async isAvailable(): Promise<boolean> {
        if (!this.isDiscoveryDone) {
            this.kittyPath = await this.discoverKittyPath();
            this.isDiscoveryDone = true;
        }
        return this.kittyPath !== null;
    }

    /**
     * Create a new terminal session by spawning Kitty externally.
     */
    public async create(options: TerminalCreateOptions): Promise<ITerminalProcess> {
        if (!this.isDiscoveryDone) {
            this.kittyPath = await this.discoverKittyPath();
            this.isDiscoveryDone = true;
        }

        if (!this.kittyPath) {
            throw new Error('Kitty is not installed or not in PATH');
        }

        appLogger.info('KittyBackend', `Opening Kitty session: ${options.id}`);

        const args = [
            '--directory', options.cwd,
            '--',
            options.shell,
            ...options.args
        ];

        let child: ChildProcess | null = null;
        try {
            child = spawn(this.kittyPath, args, {
                cwd: options.cwd,
                env: options.env as NodeJS.ProcessEnv,
                detached: true,
                stdio: 'ignore'
            });

            child.unref();
            setTimeout(() => options.onData('\r\n[Kitty window opened]\r\n'), 100);

            child.on('exit', (code) => {
                appLogger.info('KittyBackend', `Kitty process exited with code ${code}`);
                options.onExit(code ?? 0);
            });
        } catch (error) {
            appLogger.error('KittyBackend', 'Failed to spawn Kitty', error as Error);
            throw error;
        }

        return {
            write: (_data: string) => {
                appLogger.info('KittyBackend', 'External Kitty window: input bridging not yet supported');
            },
            resize: (_cols: number, _rows: number) => {
                // Not applicable for external standalone window.
            },
            kill: () => {
                if (child && !child.killed) {
                    child.kill();
                }
            }
        };
    }

    private async discoverKittyPath(): Promise<string | null> {
        const isWin = process.platform === 'win32';
        const cmd = isWin ? 'where kitty' : 'which kitty';

        try {
            const result = execSync(cmd, { encoding: 'utf8' }).trim();
            if (result) {
                const first = result.split('\n')[0].trim();
                appLogger.info('KittyBackend', `Found Kitty at: ${first}`);
                return first;
            }
        } catch {
            appLogger.debug('KittyBackend', 'Kitty not found in PATH');
        }

        const commonPaths = isWin
            ? [
                'C:\\Program Files\\kitty\\kitty.exe',
                'C:\\Program Files\\Kitty\\kitty.exe',
                path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'kitty', 'kitty.exe'),
                path.join(process.env.LOCALAPPDATA ?? '', 'kitty', 'kitty.exe')
            ]
            : [
                '/Applications/kitty.app/Contents/MacOS/kitty',
                '/usr/local/bin/kitty',
                '/usr/bin/kitty',
                '/opt/kitty/bin/kitty'
            ];

        for (const candidate of commonPaths) {
            try {
                if (fs.existsSync(candidate)) {
                    appLogger.info('KittyBackend', `Found Kitty at common location: ${candidate}`);
                    return candidate;
                }
            } catch {
                // Ignore failed path checks.
            }
        }

        return null;
    }
}
