import { ChildProcess, execSync,spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';

import { ITerminalBackend, ITerminalProcess, TerminalCreateOptions } from './terminal-backend.interface';

/**
 * Terminal backend implementation for Ghostty.
 * 
 * Ghostty is a fast, GPU-accelerated terminal emulator written in Zig.
 * On systems where Ghostty is installed, this backend provides high-performance
 * terminal capabilities.
 * 
 * NOTE: Since Ghostty is an external terminal, this backend either spawns 
 * Ghostty windows or interacts with them via socket if supported.
 * For the initial integration, we detect its presence and provide a 
 * wrapper that can be expanded with Ghostty-specific IPC.
 */
export class GhosttyBackend implements ITerminalBackend {
    public readonly id = 'ghostty';
    private ghosttyPath: string | null = null;
    private isDiscoveryDone = false;

    constructor() {
        // Path discovery is lazy-loaded or done on isAvailable()
    }

    /**
     * Check if Ghostty is available on the system
     */
    public async isAvailable(): Promise<boolean> {
        if (!this.isDiscoveryDone) {
            this.ghosttyPath = await this.discoverGhosttyPath();
            this.isDiscoveryDone = true;
        }
        return this.ghosttyPath !== null;
    }

    /**
     * Create a new terminal session
     * 
     * Since Ghostty is a standalone terminal, "creating" a session here 
     * might mean spawning a Ghostty window in a way that Orbit can track,
     * or eventually using Ghostty as a PTY provider if it supports a headless mode
     * that outputs to a stream we can consume in xterm.js.
     * 
     * Currently, we implement a basic spawn mechanism.
     */
    public async create(options: TerminalCreateOptions): Promise<ITerminalProcess> {
        if (!this.isDiscoveryDone) {
            this.ghosttyPath = await this.discoverGhosttyPath();
            this.isDiscoveryDone = true;
        }

        if (!this.ghosttyPath) {
            throw new Error('Ghostty is not installed or not in PATH');
        }

        appLogger.info('GhosttyBackend', `Opening Ghostty session: ${options.id}`);

        // For now, we spawn Ghostty as an external process.
        // In the future, we will use its IPC/Socket features to bridge it into our UI
        // or use its libterminal-based core if we bundle it.
        const args = [
            '--working-directory', options.cwd,
            '--command', options.shell,
            ...options.args
        ];

        let child: ChildProcess | null = null;
        try {
            child = spawn(this.ghosttyPath, args, {
                cwd: options.cwd,
                env: options.env as NodeJS.ProcessEnv,
                detached: true,
                stdio: 'ignore'
            });

            child.unref(); // Allow orbit to exit independently

            // Immediately notify success since it's an external window for now
            // PTY-like behavior will be added when we have the IPC bridge
            setTimeout(() => options.onData('\r\n[Ghostty window opened]\r\n'), 100);

            child.on('exit', (code) => {
                appLogger.info('GhosttyBackend', `Ghostty process exited with code ${code}`);
                options.onExit(code ?? 0);
            });

        } catch (error) {
            appLogger.error('GhosttyBackend', 'Failed to spawn Ghostty', error as Error);
            throw error;
        }

        return {
            write: (_data: string) => {
                // TODO: Send input via Ghostty socket/IPC
                appLogger.info('GhosttyBackend', 'External Ghostty window: write not yet bridged via IPC');
            },
            resize: (_cols: number, _rows: number) => {
                // Internal window resizing doesn't apply to external Ghostty window yet
            },
            kill: () => {
                if (child && !child.killed) {
                    child.kill();
                }
            }
        };
    }

    private async discoverGhosttyPath(): Promise<string | null> {
        const isWin = process.platform === 'win32';
        const cmd = isWin ? 'where ghostty' : 'which ghostty';

        try {
            const result = execSync(cmd, { encoding: 'utf8' }).trim();
            if (result) {
                // 'where' can return multiple lines
                const path = result.split('\n')[0].trim();
                appLogger.info('GhosttyBackend', `Found Ghostty at: ${path}`);
                return path;
            }
        } catch {
            appLogger.debug('GhosttyBackend', 'Ghostty not found in PATH');
        }

        // Common locations if not in PATH
        const commonPaths = isWin
            ? [
                'C:\\Program Files\\Ghostty\\ghostty.exe',
                path.join(process.env.LOCALAPPDATA ?? '', 'Ghostty', 'ghostty.exe')
            ]
            : [
                '/Applications/Ghostty.app/Contents/MacOS/ghostty',
                '/usr/local/bin/ghostty',
                '/usr/bin/ghostty'
            ];

        for (const p of commonPaths) {
            try {
                if (fs.existsSync(p)) {
                    appLogger.info('GhosttyBackend', `Found Ghostty at common location: ${p}`);
                    return p;
                }
            } catch {
                // Ignore
            }
        }

        return null;
    }
}
