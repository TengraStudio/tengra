import { exec } from 'child_process';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

import { appLogger } from '@main/logging/logger';
import { getErrorMessage } from '@shared/utils/error.util';
import { quoteShellArg,safeJsonParse } from '@shared/utils/sanitize.util';
import * as pty from 'node-pty';


const execAsync = promisify(exec);

// Interface for a running task
export interface TaskProcess {
    id: string
    pid: number
    command: string
    args: string[]
    startTime: number
    status: 'running' | 'stopped' | 'failed'
    cwd: string
    ptyProcess: pty.IPty
}

export class ProcessService extends EventEmitter {
    private processes: Map<string, TaskProcess> = new Map();
    private shell: string;

    constructor() {
        super();
        this.shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    }

    // --- Task Runner (2.2.21) ---

    // Spawn a process using node-pty for terminal integration
    spawn(command: string, args: string[], cwd: string): string {
        const id = Math.random().toString(36).substring(7);

        appLogger.info('process.service', `[ProcessService] Spawning: ${command} ${args.join(' ')} in ${cwd} `);

        // Quote arguments to prevent injection
        const safeArgs = args.map(quoteShellArg);

        // Combine command and arguments safely
        // Note: node-pty on Windows with 'bits' of shell usage might still be complex,
        // but quoting individual args is safer than raw join.
        // For pty.spawn with shell (powershell), we pass the command line string to -c (or implicit).
        // pty.spawn(file, args, options)
        // If file is 'powershell.exe', args should be the arguments to powershell.
        // If we want to run a command inside, we usually do: powershell.exe -c "command arg1 arg2"

        const commandLine = `${command} ${safeArgs.join(' ')}`;

        const ptyProcess = pty.spawn(this.shell, ['-Command', commandLine], {
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

        // Relay data to frontend
        ptyProcess.onData((data) => {
            this.emit('data', { id, data });
        });

        ptyProcess.onExit(({ exitCode }) => {
            appLogger.info('process.service', `[ProcessService] Task ${id} exited with ${exitCode} `);
            task.status = exitCode === 0 ? 'stopped' : 'failed';
            this.emit('exit', { id, code: exitCode });
            // Optional: Keep in history, but remove active reference later?
            // For now, keep it so we can query status
            if (exitCode === 0) {
                this.processes.delete(id);
            }
        });

        return id;
    }

    kill(id: string) {
        const task = this.processes.get(id);
        if (task) {
            appLogger.info('process.service', `[ProcessService] Killing task ${id} `);
            task.ptyProcess.kill();
            task.status = 'stopped';
            this.processes.delete(id);
            return true;
        }
        return false;
    }

    getEncoding() {
        // ...
    }

    // --- Script Auto-Discovery (2.2.22) ---

    async scanScripts(rootPath: string): Promise<Record<string, string>> {
        const scripts: Record<string, string> = {};

        try {
            // NPM / Node
            const pkgPath = path.join(rootPath, 'package.json');
            const pkgExists = await fs.access(pkgPath).then(() => true).catch(() => false);

            if (pkgExists) {
                const content = await fs.readFile(pkgPath, 'utf-8');
                const pkg = safeJsonParse<Record<string, unknown>>(content, {});
                if (pkg.scripts && typeof pkg.scripts === 'object') {
                    Object.assign(scripts, pkg.scripts);
                }
            }

            // Python (basic check for manage.py or similar)
            // Makefile?
        } catch (error) {
            console.error('[ProcessService] Failed to scan scripts:', getErrorMessage(error as Error));
        }

        return scripts;
    }

    // --- Process Manager (2.2.23) ---

    getRunningTasks(): Array<{ id: string; pid: number; command: string; cwd: string; status: string; startTime: number }> {
        return Array.from(this.processes.values()).map(t => ({
            id: t.id,
            pid: t.pid,
            command: t.command,
            cwd: t.cwd,
            status: t.status,
            startTime: t.startTime
        }));
    }

    resize(id: string, cols: number, rows: number): boolean {
        const task = this.processes.get(id);
        if (!task) { return false; }
        try {
            task.ptyProcess.resize(cols, rows);
            return true;
        } catch (e) {
            console.error(`[ProcessService] Resize failed for task ${id}: `, e);
            return false;
        }
    }

    write(id: string, data: string): boolean {
        const task = this.processes.get(id);
        if (!task) { return false; }
        try {
            task.ptyProcess.write(data);
            return true;
        } catch (e) {
            // Broken pipe errors are common when process has exited
            const errorMsg = getErrorMessage(e as Error);
            if (!errorMsg.includes('EPIPE') && !errorMsg.includes('broken pipe')) {
                console.error(`[ProcessService] Write failed for task ${id}: `, e);
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
