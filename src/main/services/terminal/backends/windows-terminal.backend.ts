import { ChildProcess, execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';

import { ITerminalBackend, ITerminalProcess, TerminalCreateOptions } from './terminal-backend.interface';

/**
 * Terminal backend implementation for Windows Terminal (wt.exe).
 *
 * This backend is Windows-only and opens an external Windows Terminal window.
 */
export class WindowsTerminalBackend implements ITerminalBackend {
    public readonly id = 'windows-terminal';
    private windowsTerminalPath: string | null = null;
    private isDiscoveryDone = false;

    public async isAvailable(): Promise<boolean> {
        if (process.platform !== 'win32') {
            return false;
        }

        if (!this.isDiscoveryDone) {
            this.windowsTerminalPath = await this.discoverWindowsTerminalPath();
            this.isDiscoveryDone = true;
        }
        return this.windowsTerminalPath !== null;
    }

    public async create(options: TerminalCreateOptions): Promise<ITerminalProcess> {
        if (!(await this.isAvailable())) {
            throw new Error('Windows Terminal is not installed or not available on this OS');
        }
        if (!this.windowsTerminalPath) {
            throw new Error('Windows Terminal path could not be resolved');
        }

        appLogger.info('WindowsTerminalBackend', `Opening Windows Terminal session: ${options.id}`);

        const args = [
            '-d', options.cwd,
            options.shell,
            ...options.args
        ];

        let child: ChildProcess | null = null;
        try {
            child = spawn(this.windowsTerminalPath, args, {
                cwd: options.cwd,
                env: options.env as NodeJS.ProcessEnv,
                detached: true,
                stdio: 'ignore'
            });

            child.unref();
            setTimeout(() => options.onData('\r\n[Windows Terminal window opened]\r\n'), 100);

            child.on('exit', (code) => {
                appLogger.info('WindowsTerminalBackend', `Windows Terminal process exited with code ${code}`);
                options.onExit(code ?? 0);
            });
        } catch (error) {
            appLogger.error('WindowsTerminalBackend', 'Failed to spawn Windows Terminal', error as Error);
            throw error;
        }

        return {
            write: (_data: string) => {
                appLogger.info('WindowsTerminalBackend', 'External Windows Terminal window: input bridging not yet supported');
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

    private async discoverWindowsTerminalPath(): Promise<string | null> {
        if (process.platform !== 'win32') {
            return null;
        }

        try {
            const result = execSync('where wt', { encoding: 'utf8' }).trim();
            if (result) {
                const first = result.split('\n')[0].trim();
                appLogger.info('WindowsTerminalBackend', `Found wt.exe at: ${first}`);
                return first;
            }
        } catch {
            appLogger.debug('WindowsTerminalBackend', 'wt.exe not found in PATH');
        }

        const commonPaths = [
            path.join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WindowsApps', 'wt.exe'),
            path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'WindowsApps', 'wt.exe')
        ];

        for (const candidate of commonPaths) {
            try {
                if (fs.existsSync(candidate)) {
                    appLogger.info('WindowsTerminalBackend', `Found wt.exe at common location: ${candidate}`);
                    return candidate;
                }
            } catch {
                // Ignore failed path checks.
            }
        }

        return null;
    }
}
