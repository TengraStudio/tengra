import { ChildProcess, execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { app } from 'electron';

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
    private readonly bridgeRoot: string;
    private readonly sessionBridges = new Map<string, {
        commandFilePath: string;
        inputBuffer: string;
    }>();

    constructor() {
        // Path discovery is lazy-loaded or done on isAvailable()
        try {
            this.bridgeRoot = path.join(app.getPath('userData'), 'ghostty-ipc');
        } catch {
            this.bridgeRoot = path.join(process.cwd(), '.ghostty-ipc');
        }
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
        await fs.promises.mkdir(this.bridgeRoot, { recursive: true });
        const commandFilePath = path.join(this.bridgeRoot, `${options.id}.commands`);
        await fs.promises.writeFile(commandFilePath, '', { encoding: 'utf8', flag: 'a' });
        this.sessionBridges.set(options.id, { commandFilePath, inputBuffer: '' });

        const ghosttyArgs = [
            '--working-directory', options.cwd,
            '--command', options.shell,
            ...this.buildShellArgs(options.shell, options.args, commandFilePath)
        ];

        let child: ChildProcess | null = null;
        try {
            child = spawn(this.ghosttyPath, ghosttyArgs, {
                cwd: options.cwd,
                env: options.env as NodeJS.ProcessEnv,
                detached: true,
                stdio: 'ignore'
            });

            child.unref(); // Allow orbit to exit independently

            // Notify renderer that an external Ghostty window and IPC bridge are ready.
            setTimeout(() => options.onData(`\r\n[Ghostty window opened]\r\n[Ghostty IPC ready: ${commandFilePath}]\r\n`), 100);

            child.on('exit', (code) => {
                appLogger.info('GhosttyBackend', `Ghostty process exited with code ${code}`);
                this.sessionBridges.delete(options.id);
                options.onExit(code ?? 0);
            });

        } catch (error) {
            appLogger.error('GhosttyBackend', 'Failed to spawn Ghostty', error as Error);
            throw error;
        }

        return {
            write: (data: string) => {
                this.appendInputToBridge(options.id, data);
            },
            resize: (_cols: number, _rows: number) => {
                // Internal window resizing doesn't apply to external Ghostty window yet
            },
            kill: () => {
                if (child && !child.killed) {
                    child.kill();
                }
                this.sessionBridges.delete(options.id);
            }
        };
    }

    private buildShellArgs(shellPath: string, fallbackArgs: string[], commandFilePath: string): string[] {
        const lowerShell = shellPath.toLowerCase();
        if (process.platform === 'win32' && (lowerShell.includes('powershell') || lowerShell.includes('pwsh'))) {
            const escapedPath = commandFilePath.replace(/'/g, "''");
            const command = [
                `$path='${escapedPath}'`,
                "if (!(Test-Path $path)) { New-Item -ItemType File -Path $path -Force | Out-Null }",
                "Write-Host '[Orbit Ghostty IPC bridge active]'",
                "Get-Content -Path $path -Wait | ForEach-Object {",
                "  if ($_ -and $_.Trim().Length -gt 0) {",
                "    try { Invoke-Expression $_ } catch { Write-Host $_.Exception.Message -ForegroundColor Red }",
                '  }',
                '}'
            ].join('; ');
            return ['-NoExit', '-Command', command];
        }

        const escapedPath = commandFilePath.replace(/'/g, "'\\''");
        const command = [
            `touch '${escapedPath}'`,
            "echo '[Orbit Ghostty IPC bridge active]'",
            `tail -n 0 -F '${escapedPath}' | while IFS= read -r line; do`,
            '  [ -z "$line" ] && continue',
            '  eval "$line"',
            'done'
        ].join('; ');

        // Prefer explicit command execution args for Bourne-like shells.
        if (lowerShell.includes('bash') || lowerShell.includes('zsh') || lowerShell.endsWith('/sh')) {
            return ['-lc', command];
        }

        return [...fallbackArgs, '-c', command];
    }

    private appendInputToBridge(sessionId: string, data: string): void {
        const bridge = this.sessionBridges.get(sessionId);
        if (!bridge) {
            appLogger.warn('GhosttyBackend', `No IPC bridge found for session ${sessionId}`);
            return;
        }

        let inputBuffer = bridge.inputBuffer;
        const commandsToAppend: string[] = [];

        for (let i = 0; i < data.length; i += 1) {
            const char = data[i] ?? '';
            if (char === '\r' || char === '\n') {
                const command = inputBuffer.trim();
                if (command.length > 0) {
                    commandsToAppend.push(command);
                }
                inputBuffer = '';
                continue;
            }
            if (char === '\b' || char === '\x7f') {
                inputBuffer = inputBuffer.slice(0, -1);
                continue;
            }
            if (char.charCodeAt(0) >= 32) {
                inputBuffer += char;
            }
        }

        bridge.inputBuffer = inputBuffer;
        this.sessionBridges.set(sessionId, bridge);

        if (commandsToAppend.length === 0) {
            return;
        }

        const payload = `${commandsToAppend.join(os.EOL)}${os.EOL}`;
        void this.writeBridgePayloadWithRecovery(bridge.commandFilePath, payload);
    }

    private async writeBridgePayloadWithRecovery(commandFilePath: string, payload: string): Promise<void> {
        try {
            await fs.promises.appendFile(commandFilePath, payload, 'utf8');
        } catch (error) {
            appLogger.warn('GhosttyBackend', `Bridge append failed, retrying create+append for ${commandFilePath}`, error as Error);
            try {
                await fs.promises.writeFile(commandFilePath, '', { encoding: 'utf8', flag: 'a' });
                await fs.promises.appendFile(commandFilePath, payload, 'utf8');
            } catch (retryError) {
                appLogger.error('GhosttyBackend', `Bridge append retry failed for ${commandFilePath}`, retryError as Error);
            }
        }
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
                // Sync I/O acceptable: one-time shell detection at backend init
                if (fs.existsSync(p)) {
                    appLogger.info('GhosttyBackend', `Found Ghostty at common location: ${p}`);
                }
            } catch {
                // Ignore
            }
        }

        return null;
    }
}
