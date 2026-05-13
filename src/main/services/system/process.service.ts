/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { exec } from 'child_process';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

import { ipc } from '@main/core/ipc-decorators';
import { BaseService } from '@main/services/base.service';
import { resolveWindowsCommand } from '@main/utils/windows-command.util';
import { PROCESS_CHANNELS } from '@shared/constants/ipc-channels';
import { IPC_TIMEOUTS } from '@shared/constants/timeouts';
import { RuntimeValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { quoteShellArg, safeJsonParse } from '@shared/utils/sanitize.util';
import { BrowserWindow } from 'electron';
import * as pty from 'node-pty';

type UnsafeValue = ReturnType<typeof JSON.parse>;

const execAsync = promisify(exec);
const SENSITIVE_FLAG_PATTERN = /^(?:--?(?:token|password|pass|secret|api[-_]?key|auth|authorization)|\/(?:p|pass|password))$/i;

const MAX_COMMAND_LENGTH = 1024;
const MAX_PATH_LENGTH = 4096;
const MAX_ID_LENGTH = 64;
const MAX_DATA_LENGTH = 65536;
const MAX_ARGS = 100;
const MAX_COLS = 1000;
const MAX_ROWS = 500;

function redactSensitiveArgs(args: string[]): string {
    const redacted: string[] = [];
    for (let i = 0; i < args.length; i += 1) {
        const current = args[i];
        const [key, value] = current.split('=', 2);
        if (SENSITIVE_FLAG_PATTERN.test(key) && typeof value === 'string') {
            redacted.push(`${key}=***`);
            continue;
        }
        if (SENSITIVE_FLAG_PATTERN.test(current)) {
            redacted.push(current);
            if (i + 1 < args.length) {
                redacted.push('***');
                i += 1;
            }
            continue;
        }
        redacted.push(current);
    }
    return redacted.join(' ');
}

// Interface for a running task
export interface TaskProcess {
    id: string;
    pid: number;
    command: string;
    args: string[];
    startTime: number;
    status: 'running' | 'stopped' | 'failed';
    cwd: string;
    ptyProcess: pty.IPty;
}

export class ProcessService extends BaseService {
    static readonly serviceName = 'processService';
    static readonly dependencies = ['mainWindowProvider'] as const;
    private processes: Map<string, TaskProcess> = new Map();
    private shell: string;
    private shellArgsPrefix: string[];
    private emitter = new EventEmitter();
    private buffers = new Map<string, string>();
    private flushTimer: NodeJS.Timeout | null = null;

    constructor(private readonly mainWindowProvider: () => BrowserWindow | null) {
        super('ProcessService');
        if (os.platform() === 'win32') {
            this.shell = 'powershell.exe';
            this.shellArgsPrefix = ['-Command'];
        } else {
            this.shell = (process.env.SHELL && process.env.SHELL.trim().length > 0)
                ? process.env.SHELL
                : 'bash';
            this.shellArgsPrefix = ['-c'];
        }

        // Setup output buffering
        this.on('data', ({ id, data }) => {
            const current = this.buffers.get(id) ?? '';
            this.buffers.set(id, current + data);

            if (!this.flushTimer) {
                this.flushTimer = setTimeout(() => this.flushBuffers(), IPC_TIMEOUTS.BUFFER_FLUSH);
            }
        });
    }

    private flushBuffers(): void {
        if (this.buffers.size === 0) {
            this.flushTimer = null;
            return;
        }

        const win = this.mainWindowProvider();
        if (win && !win.isDestroyed()) {
            this.buffers.forEach((data, id) => {
                win.webContents.send(PROCESS_CHANNELS.DATA, { id, data });
            });
        }
        this.buffers.clear();
        this.flushTimer = null;
    }

    // --- EventEmitter Bridge ---
    on(event: string, listener: (...args: UnsafeValue[]) => void): this {
        this.emitter.on(event, listener);
        return this;
    }

    emit(event: string, ...args: UnsafeValue[]): boolean {
        return this.emitter.emit(event, ...args);
    }

    // --- Validation Utilities ---

    private validateCommand(value: RuntimeValue): string | null {
        if (typeof value !== 'string') { return null; }
        const trimmed = value.trim();
        if (!trimmed || trimmed.length > MAX_COMMAND_LENGTH) { return null; }
        // Security: Block shell control characters (SEC-001-3)
        if (/[;&|`$(){}<>\r\n\0]/.test(trimmed)) { return null; }
        return trimmed;
    }

    private validatePath(value: RuntimeValue): string | null {
        if (typeof value !== 'string') { return null; }
        const trimmed = value.trim();
        if (!trimmed || trimmed.length > MAX_PATH_LENGTH) { return null; }
        return trimmed;
    }

    private validateId(value: RuntimeValue): string | null {
        if (typeof value !== 'string') { return null; }
        const trimmed = value.trim();
        if (!trimmed || trimmed.length > MAX_ID_LENGTH) { return null; }
        return trimmed;
    }

    private validateArgs(value: RuntimeValue): string[] {
        if (!Array.isArray(value)) { return []; }
        return value
            .slice(0, MAX_ARGS)
            .filter((arg): arg is string => typeof arg === 'string')
            .map(arg => arg.slice(0, MAX_COMMAND_LENGTH));
    }

    private validateNumber(value: RuntimeValue, min: number, max: number): number | null {
        if (typeof value !== 'number' || !Number.isFinite(value)) { return null; }
        if (value < min || value > max) { return null; }
        return Math.floor(value);
    }

    // --- Task Runner ---

    @ipc(PROCESS_CHANNELS.SPAWN)
    async spawnIpc(commandRaw: RuntimeValue, argsRaw: RuntimeValue, cwdRaw: RuntimeValue): Promise<string | null> {
        const command = this.validateCommand(commandRaw);
        if (!command) {
            throw new Error('error.process.invalid_command');
        }

        const args = this.validateArgs(argsRaw);
        const cwd = this.validatePath(cwdRaw) ?? process.cwd();

        return this.spawn(command, args, cwd);
    }

    spawn(command: string, args: string[], cwd: string): string {
        const id = crypto.randomUUID().substring(0, 8);
        const resolvedCommand = resolveWindowsCommand(command);

        this.logInfo(`Spawning: ${resolvedCommand} ${redactSensitiveArgs(args)} in ${cwd}`);

        const safeArgs = args.map(quoteShellArg);
        const commandLine = `${quoteShellArg(resolvedCommand)} ${safeArgs.join(' ')}`;

        const ptyProcess = pty.spawn(this.shell, [...this.shellArgsPrefix, commandLine], {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd: cwd,
            env: process.env
        });

        const task: TaskProcess = {
            id,
            pid: ptyProcess.pid,
            command,
            args,
            startTime: Date.now(),
            status: 'running',
            cwd,
            ptyProcess
        };

        this.processes.set(id, task);

        ptyProcess.onData((data) => {
            this.emit('data', { id, data });
        });

        ptyProcess.onExit(({ exitCode }) => {
            this.logInfo(`Task ${id} exited with ${exitCode}`);
            task.status = exitCode === 0 ? 'stopped' : 'failed';
            this.emit('exit', { id, code: exitCode });
            if (exitCode === 0) {
                this.processes.delete(id);
            }
        });

        return id;
    }

    @ipc(PROCESS_CHANNELS.KILL)
    async killIpc(idRaw: RuntimeValue): Promise<boolean> {
        const id = this.validateId(idRaw);
        if (!id) {
            throw new Error('Invalid process ID');
        }
        return this.kill(id);
    }

    kill(id: string): boolean {
        const task = this.processes.get(id);
        if (task) {
            this.logInfo(`Killing task ${id}`);
            task.ptyProcess.kill();
            task.status = 'stopped';
            this.processes.delete(id);
            return true;
        }
        return false;
    }

    // --- Script Auto-Discovery ---

    @ipc(PROCESS_CHANNELS.SCAN_SCRIPTS)
    async scanScriptsIpc(rootPathRaw: RuntimeValue): Promise<Record<string, string>> {
        const rootPath = this.validatePath(rootPathRaw);
        if (!rootPath) {
            throw new Error('Invalid root path');
        }
        return await this.scanScripts(rootPath);
    }

    async scanScripts(rootPath: string): Promise<Record<string, string>> {
        const scripts: Record<string, string> = {};

        try {
            const pkgPath = path.join(rootPath, 'package.json');
            const pkgExists = await fs.access(pkgPath).then(() => true).catch(() => false);

            if (pkgExists) {
                const content = await fs.readFile(pkgPath, 'utf-8');
                const pkg = safeJsonParse<Record<string, RuntimeValue>>(content, {});
                if (pkg.scripts && typeof pkg.scripts === 'object') {
                    Object.assign(scripts, pkg.scripts);
                }
            }
        } catch (error) {
            this.logError('Failed to scan scripts', error);
        }

        return scripts;
    }

    // --- Process Manager ---

    @ipc(PROCESS_CHANNELS.LIST)
    async getRunningTasksIpc(): Promise<UnsafeValue[]> {
        return this.getRunningTasks();
    }

    getRunningTasks(): Array<{
        id: string;
        pid: number;
        name: string;
        cmd: string;
        command: string;
        cpu: number;
        memory: number;
        cwd: string;
        status: string;
        startTime: number;
    }> {
        return Array.from(this.processes.values()).map(t => ({
            id: t.id,
            pid: t.pid,
            name: t.command,
            cmd: [t.command, ...t.args].join(' ').trim(),
            command: [t.command, ...t.args].join(' ').trim(),
            cpu: 0,
            memory: 0,
            cwd: t.cwd,
            status: t.status,
            startTime: t.startTime
        }));
    }

    @ipc(PROCESS_CHANNELS.RESIZE)
    async resizeIpc(idRaw: RuntimeValue, colsRaw: RuntimeValue, rowsRaw: RuntimeValue): Promise<boolean> {
        const id = this.validateId(idRaw);
        if (!id) {
            throw new Error('Invalid process ID');
        }

        const cols = this.validateNumber(colsRaw, 1, MAX_COLS);
        const rows = this.validateNumber(rowsRaw, 1, MAX_ROWS);
        if (cols === null || rows === null) {
            throw new Error('Invalid dimensions');
        }

        return this.resize(id, cols, rows);
    }

    resize(id: string, cols: number, rows: number): boolean {
        const task = this.processes.get(id);
        if (!task) { return false; }
        try {
            task.ptyProcess.resize(cols, rows);
            return true;
        } catch (e) {
            this.logError(`Resize failed for task ${id}`, e);
            return false;
        }
    }

    @ipc(PROCESS_CHANNELS.WRITE)
    async writeIpc(idRaw: RuntimeValue, dataRaw: RuntimeValue): Promise<boolean> {
        const id = this.validateId(idRaw);
        if (!id) {
            throw new Error('Invalid process ID');
        }

        if (typeof dataRaw !== 'string' || dataRaw.length > MAX_DATA_LENGTH) {
            throw new Error('Invalid data');
        }

        return this.write(id, dataRaw);
    }

    write(id: string, data: string): boolean {
        const task = this.processes.get(id);
        if (!task) { return false; }
        try {
            task.ptyProcess.write(data);
            return true;
        } catch (e) {
            const errorMsg = getErrorMessage(e as Error);
            if (!errorMsg.includes('EPIPE') && !errorMsg.includes('broken pipe')) {
                this.logError(`Write failed for task ${id}`, e);
            }
            return false;
        }
    }

    async execute(command: string, cwd?: string): Promise<string> {
        try {
            const { stdout, stderr } = await execAsync(command, { cwd });
            return (stdout || stderr) || 'Command executed successfully';
        } catch (e) {
            const msg = getErrorMessage(e as Error);
            const stderr = (e as { stderr?: string }).stderr ?? '';
            return (`Error: ${msg}\nStderr: ${(stderr || '')}`);
        }
    }
}

