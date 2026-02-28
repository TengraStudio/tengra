import { ChildProcess, execSync,spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';

import { ITerminalBackend, ITerminalProcess, TerminalCreateOptions } from './terminal-backend.interface';

/**
 * Terminal backend implementation for Warp.
 * 
 * Warp is a modern, AI-powered terminal emulator.
 * This backend provides integration for Warp as an external terminal provider.
 */
export class WarpBackend implements ITerminalBackend {
    public readonly id = 'warp';
    private warpPath: string | null = null;
    private isDiscoveryDone = false;

    constructor() {
        // Discovery is lazy-loaded
    }

    /**
     * Check if Warp is available on the system
     */
    public async isAvailable(): Promise<boolean> {
        if (!this.isDiscoveryDone) {
            this.warpPath = await this.discoverWarpPath();
            this.isDiscoveryDone = true;
        }
        return this.warpPath !== null;
    }

    /**
     * Create a new terminal session
     */
    public async create(options: TerminalCreateOptions): Promise<ITerminalProcess> {
        if (!this.isDiscoveryDone) {
            this.warpPath = await this.discoverWarpPath();
            this.isDiscoveryDone = true;
        }

        if (!this.warpPath) {
            throw new Error('Warp is not installed or not in PATH');
        }

        appLogger.info('WarpBackend', `Opening Warp session: ${options.id}`);

        // Warp CLI flags for opening tabs/windows:
        // Currently Warp for Windows is in early beta.
        // On macOS: open -a Warp <dir>
        // We'll try to use a generic spawn for the binary.
        const args = [options.cwd];

        let child: ChildProcess | null = null;
        try {
            // Warp often uses an 'open' like command or a specific binary
            child = spawn(this.warpPath, args, {
                cwd: options.cwd,
                env: options.env as NodeJS.ProcessEnv,
                detached: true,
                stdio: 'ignore'
            });

            child.unref();

            setTimeout(() => options.onData('\r\n[Warp window opened]\r\n'), 100);

            child.on('exit', (code) => {
                appLogger.info('WarpBackend', `Warp process exited with code ${code}`);
                options.onExit(code ?? 0);
            });

        } catch (error) {
            appLogger.error('WarpBackend', 'Failed to spawn Warp', error as Error);
            throw error;
        }

        return {
            write: (_data: string) => {
                appLogger.info('WarpBackend', 'External Warp window: input bridging not yet supported');
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

    private async discoverWarpPath(): Promise<string | null> {
        const isWin = process.platform === 'win32';
        const cmd = isWin ? 'where warp' : 'which warp';

        try {
            const result = execSync(cmd, { encoding: 'utf8' }).trim();
            if (result) {
                const pathResult = result.split('\n')[0].trim();
                appLogger.info('WarpBackend', `Found Warp at: ${pathResult}`);
                return pathResult;
            }
        } catch {
            appLogger.debug('WarpBackend', 'Warp not found in PATH');
        }

        const commonPaths = isWin
            ? [
                path.join(process.env.LOCALAPPDATA ?? '', 'Warp', 'warp.exe'),
                'C:\\Program Files\\Warp\\warp.exe'
            ]
            : [
                '/Applications/Warp.app/Contents/MacOS/Warp',
                '/usr/local/bin/warp',
                '/usr/bin/warp'
            ];

        for (const p of commonPaths) {
            try {
                // Sync I/O acceptable: one-time shell detection at backend init
                if (fs.existsSync(p)) {
                    appLogger.info('WarpBackend', `Found Warp at common location: ${p}`);
                }
            } catch {
                // Ignore
            }
        }

        return null;
    }
}
