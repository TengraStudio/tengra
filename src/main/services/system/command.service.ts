import { ChildProcess, exec, spawn } from 'child_process';
import { promisify } from 'util';

import { getErrorMessage } from '@shared/utils/error.util';

const execAsync = promisify(exec);

import { JsonValue } from '@shared/types/common';

interface CommandResult {
    success: boolean
    stdout?: string
    stderr?: string
    exitCode?: number
    error?: string
    [key: string]: JsonValue | undefined;
}

export class CommandService {
    private maxTimeout: number = 60000; // 60 seconds default timeout
    private activeProcesses: Map<string, ChildProcess> = new Map();
    private maxCommandLength = 10000;

    killCommand(id: string): boolean {
        const child = this.activeProcesses.get(id);
        if (child) {
            try {
                // Kill process tree
                const killCmd = `taskkill / PID ${child.pid} /T /F`;
                exec(killCmd, (err) => {
                    if (err) { console.error('Failed to kill process tree:', getErrorMessage(err as Error)); }
                });
                // Also try direct kill safety net
                child.kill();
                this.activeProcesses.delete(id);
                return true;
            } catch (err) {
                console.error('Error killing process:', getErrorMessage(err as Error));
                return false;
            }
        }
        return false;
    }

    private isCommandAllowed(command: string): { allowed: boolean; reason?: string } {
        if (!command || command.length > this.maxCommandLength) {
            return { allowed: false, reason: 'Command is empty or too long' };
        }

        const trimmed = command.trim();
        const blockedTokens = ['rm -rf', 'del /f', 'format ', 'shutdown', 'poweroff', 'reboot', 'mkfs', 'reg delete'];
        if (blockedTokens.some(token => trimmed.toLowerCase().includes(token))) {
            return { allowed: false, reason: 'Command contains blocked operation' };
        }

        // Warning for dangerous shell operators
        // We don't block them outright because some legitimate commands might use them (like pipes),
        // but we should at least be aware or stricter if needed.
        // For now, let's block multiple command chaining which is a common vector.
        const dangerousOperators = [';', '&&', '||'];
        // Note: We used to block '&' and '|' but that breaks pipes and background tasks which might be used intentionally.
        // Chaining via ; or && is more indicative of "do this THEN do that" which might unwantedly execute a second payload.
        if (dangerousOperators.some(op => trimmed.includes(op))) {
            return { allowed: false, reason: 'Command contains shell control operators which are not allowed.' };
        }

        return { allowed: true };
    }

    async executeCommand(
        command: string,
        options?: {
            cwd?: string;
            timeout?: number;
            shell?: string;
            id?: string;
        }
    ): Promise<CommandResult> {
        const safety = this.isCommandAllowed(command);
        if (!safety.allowed) {
            return {
                success: false,
                error: safety.reason ?? 'Command blocked by safety policy'
            };
        }

        if (options?.id) {
            return this.executeTrackedCommand(command, options as { cwd?: string; timeout?: number; shell?: string; id: string });
        }

        return this.executeDirectCommand(command, options);
    }

    private async executeTrackedCommand(
        command: string,
        options: { cwd?: string; timeout?: number; shell?: string; id: string }
    ): Promise<CommandResult> {
        return new Promise((resolve) => {
            const child = exec(command, {
                cwd: options.cwd ?? process.cwd(),
                timeout: options.timeout ?? this.maxTimeout,
                shell: options.shell ?? 'powershell.exe',
                maxBuffer: 10 * 1024 * 1024
            }, (error, stdout, stderr) => {
                this.activeProcesses.delete(options.id);

                if (error) {
                    resolve({
                        success: false,
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        exitCode: error.code,
                        error: getErrorMessage(error)
                    });
                } else {
                    resolve({
                        success: true,
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        exitCode: 0
                    });
                }
            });

            this.activeProcesses.set(options.id, child);
        });
    }

    private async executeDirectCommand(
        command: string,
        options?: { cwd?: string; timeout?: number; shell?: string }
    ): Promise<CommandResult> {
        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: options?.cwd ?? process.cwd(),
                timeout: options?.timeout ?? this.maxTimeout,
                shell: options?.shell ?? 'powershell.exe',
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer
            });
            return {
                success: true,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: 0
            };
        } catch (error) {
            const execError = error as { stdout?: string; stderr?: string; code?: number; message: string };
            return {
                success: false,
                stdout: execError.stdout?.trim(),
                stderr: execError.stderr?.trim(),
                exitCode: execError.code,
                error: getErrorMessage(error as Error)
            };
        }
    }

    async executeCommandStream(
        command: string,
        onStdout: (data: string) => void,
        onStderr: (data: string) => void,
        options?: { cwd?: string; timeout?: number; id?: string }
    ): Promise<CommandResult> {
        return new Promise((resolve) => {
            const safety = this.isCommandAllowed(command);
            if (!safety.allowed) {
                resolve({
                    success: false,
                    error: safety.reason ?? 'Command blocked by safety policy'
                });
                return;
            }

            const child = spawn(command, [], {
                cwd: options?.cwd ?? process.cwd(),
                shell: 'powershell.exe',
                stdio: ['ignore', 'pipe', 'pipe']
            });

            if (options?.id) {
                this.activeProcesses.set(options.id, child);
            }

            let stdout = '';
            let stderr = '';

            const timeout = setTimeout(() => {
                child.kill('SIGTERM');
                if (options?.id) { this.activeProcesses.delete(options.id); }
                resolve({
                    success: false,
                    stdout,
                    stderr,
                    error: 'Command timed out'
                });
            }, (options?.timeout ?? this.maxTimeout));

            child.stdout.on('data', (data: Buffer) => {
                const text = data.toString();
                stdout += text;
                onStdout(text);
            });

            child.stderr.on('data', (data: Buffer) => {
                const text = data.toString();
                stderr += text;
                onStderr(text);
            });

            child.on('close', (code) => {
                clearTimeout(timeout);
                if (options?.id) { this.activeProcesses.delete(options.id); }
                resolve({
                    success: code === 0,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    exitCode: code ?? undefined
                });
            });

            child.on('error', (error) => {
                clearTimeout(timeout);
                if (options?.id) { this.activeProcesses.delete(options.id); }
                resolve({
                    success: false,
                    stdout,
                    stderr,
                    error: getErrorMessage(error)
                });
            });
        });
    }

    async getSystemInfo(): Promise<SystemInfoResult> {
        const [hostname, username, osInfo] = await Promise.all([
            this.executeCommand('hostname'),
            this.executeCommand('$env:USERNAME'),
            this.executeCommand('[System.Environment]::OSVersion.VersionString')
        ]);

        return {
            hostname: hostname.stdout,
            username: username.stdout,
            os: osInfo.stdout,
            cwd: process.cwd(),
            platform: process.platform,
            arch: process.arch
        };
    }
}

interface SystemInfoResult {
    hostname: string | undefined;
    username: string | undefined;
    os: string | undefined;
    cwd: string;
    platform: NodeJS.Platform;
    arch: string;
}
