import { ChildProcess, execSync,spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';

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
            throw new Error('Alacritty is not installed or not in PATH');
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
        const isWin = process.platform === 'win32';
        const cmd = isWin ? 'where alacritty' : 'which alacritty';

        try {
            const result = execSync(cmd, { encoding: 'utf8' }).trim();
            if (result) {
                const pathResult = result.split('\n')[0].trim();
                appLogger.info('AlacrittyBackend', `Found Alacritty at: ${pathResult}`);
                return pathResult;
            }
        } catch {
            appLogger.debug('AlacrittyBackend', 'Alacritty not found in PATH');
        }

        const commonPaths = isWin
            ? [
                'C:\\Program Files\\Alacritty\\alacritty.exe',
                path.join(process.env.LOCALAPPDATA ?? '', 'Alacritty', 'alacritty.exe')
            ]
            : [
                '/Applications/Alacritty.app/Contents/MacOS/alacritty',
                '/usr/local/bin/alacritty',
                '/usr/bin/alacritty'
            ];

        for (const p of commonPaths) {
            try {
                // Sync I/O acceptable: one-time shell detection at backend init
                if (fs.existsSync(p)) {
                    appLogger.info('AlacrittyBackend', `Found Alacritty at common location: ${p}`);
                }
            } catch {
                // Ignore
            }
        }

        return null;
    }
}
