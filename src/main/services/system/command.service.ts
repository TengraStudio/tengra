/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ChildProcess, exec, spawn } from 'child_process';
import { promisify } from 'util';

import { appLogger } from '@main/logging/logger';
import { validateCommand } from '@main/utils/command-validator.util';
import { JsonValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';

const execAsync = promisify(exec);
const DEFAULT_EXEC_SHELL = process.platform === 'win32'
    ? 'powershell.exe'
    : (process.env.SHELL && process.env.SHELL.trim().length > 0 ? process.env.SHELL : '/bin/bash');

interface CommandResult {
    success: boolean;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    error?: string;
    [key: string]: JsonValue | undefined;
}

export class CommandService {
    private maxTimeout = 60000; // 60 seconds default timeout
    private activeProcesses: Map<string, ChildProcess> = new Map();
    private static readonly MAX_ACTIVE_PROCESSES = 50;

    /**
     * Clean up all active processes on service disposal
     */
    async dispose(): Promise<void> {
        appLogger.info('CommandService', `Disposing service, killing ${this.activeProcesses.size} active processes`);
        for (const id of this.activeProcesses.keys()) {
            this.killCommand(id);
        }
        this.activeProcesses.clear();
    }

    killCommand(id: string): boolean {
        const child = this.activeProcesses.get(id);
        if (child) {
            try {
                if (typeof child.pid === 'number' && Number.isFinite(child.pid)) {
                    // Suppress noisy "process not found" errors from taskkill for already-exited children.
                    const killCmd = `cmd /c "taskkill /PID ${child.pid} /T /F 2>nul"`;
                    exec(killCmd, () => {
                        // Intentionally ignored: child may already be gone.
                    });
                }
                // Also try direct kill safety net
                child.kill();
                this.activeProcesses.delete(id);
                return true;
            } catch (err) {
                appLogger.error('CommandService', 'Error killing process', err as Error);
                return false;
            }
        }
        return false;
    }

    private isCommandAllowed(command: string): { allowed: boolean; reason?: string } {
        return validateCommand(command);
    }

    private isPowerShellShell(shell: string): boolean {
        const normalized = shell.toLowerCase();
        return normalized.includes('powershell') || normalized.includes('pwsh');
    }

    private replaceWindowsEnvVarSyntax(command: string): string {
        return command.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (_match, varName: string) => `$env:${varName}`);
    }

    private replaceWindowsIfNotExistMkdir(command: string): string {
        const cmdIfPattern = /if\s+not\s+exist\s+("[^"]+"|'[^']+'|\S+)\s+mkdir\s+("[^"]+"|'[^']+'|\S+)/giu;
        return command.replace(
            cmdIfPattern,
            (_match, probePath: string, targetPath: string) =>
                `if (!(Test-Path ${probePath})) { New-Item -ItemType Directory -Path ${targetPath} -Force | Out-Null }`
        );
    }

    private normalizeWindowsPowerShellCommand(command: string): string {
        const withEnvVars = this.replaceWindowsEnvVarSyntax(command);
        return this.replaceWindowsIfNotExistMkdir(withEnvVars);
    }

    private resolveExecutionContext(command: string, shellOverride?: string): { command: string; shell: string } {
        const shell = shellOverride ?? DEFAULT_EXEC_SHELL;
        if (process.platform !== 'win32' || !this.isPowerShellShell(shell)) {
            return { command, shell };
        }
        return { command: this.normalizeWindowsPowerShellCommand(command), shell };
    }

    private parseCommand(command: string): { executable: string; args: string[] } | null {
        const tokens = command.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
        if (tokens.length === 0) {
            return null;
        }

        const [rawExecutable, ...rawArgs] = tokens;
        if (!rawExecutable) {
            return null;
        }

        const executable = rawExecutable.replace(/^"(.*)"$/u, '$1').trim();
        if (executable.length === 0) {
            return null;
        }

        return {
            executable,
            args: rawArgs.map(arg => arg.replace(/^"(.*)"$/u, '$1')),
        };
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
        if (this.activeProcesses.size >= CommandService.MAX_ACTIVE_PROCESSES) {
            return {
                success: false,
                error: `Command blocked: Too many active processes (Limit: ${CommandService.MAX_ACTIVE_PROCESSES})`
            };
        }
        const executionContext = this.resolveExecutionContext(command, options.shell);
        return new Promise((resolve) => {
            const child = exec(executionContext.command, {
                cwd: options.cwd ?? process.cwd(),
                timeout: options.timeout ?? this.maxTimeout,
                shell: executionContext.shell,
                maxBuffer: 10 * 1024 * 1024,
                windowsHide: true
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
        if (this.activeProcesses.size >= CommandService.MAX_ACTIVE_PROCESSES) {
            return {
                success: false,
                error: `Command blocked: Too many active processes (Limit: ${CommandService.MAX_ACTIVE_PROCESSES})`
            };
        }

        const id = `direct-${Date.now()}`;
        this.activeProcesses.set(id, {} as ChildProcess);

        try {
            return await this.runDirect(command, options);
        } finally {
            this.activeProcesses.delete(id);
        }
    }

    private async runDirect(command: string, options?: { cwd?: string; timeout?: number; shell?: string }): Promise<CommandResult> {
        const executionContext = this.resolveExecutionContext(command, options?.shell);
        try {
            const { stdout, stderr } = await execAsync(executionContext.command, {
                cwd: options?.cwd ?? process.cwd(),
                timeout: options?.timeout ?? this.maxTimeout,
                shell: executionContext.shell,
                maxBuffer: 10 * 1024 * 1024,
                windowsHide: true
            });
            return { success: true, stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
        } catch (error) {
            const err = error as { stdout?: string; stderr?: string; code?: number };
            return {
                success: false,
                stdout: err.stdout?.trim(),
                stderr: err.stderr?.trim(),
                exitCode: err.code,
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

            const parsed = this.parseCommand(command);
            if (!parsed) {
                resolve({
                    success: false,
                    error: 'Invalid command format'
                });
                return;
            }

            let spawnCommand = parsed.executable;
            let spawnArgs = parsed.args;
            let useShell = false;

            if (process.platform === 'win32' && (parsed.executable.toLowerCase().endsWith('.cmd') || parsed.executable.toLowerCase().endsWith('.bat'))) {
                spawnCommand = process.env.ComSpec || 'cmd.exe';
                spawnArgs = ['/d', '/s', '/c', parsed.executable, ...parsed.args];
                useShell = false;
            }

            const child = spawn(spawnCommand, spawnArgs, {
                cwd: options?.cwd ?? process.cwd(),
                shell: useShell,
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true
            });

            if (options?.id) {
                if (this.activeProcesses.size >= CommandService.MAX_ACTIVE_PROCESSES) {
                    resolve({
                        success: false,
                        stdout: '',
                        stderr: '',
                        error: `Command blocked: Too many active processes (Limit: ${CommandService.MAX_ACTIVE_PROCESSES})`
                    });
                    child.kill(); // Ensure we don't leak the spawned process since we rejected it
                    return;
                }
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

