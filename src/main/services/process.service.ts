import * as pty from 'node-pty'
import * as os from 'os'
import * as path from 'path'
import { promises as fs } from 'fs'
import { EventEmitter } from 'events'
import { exec } from 'child_process'
import { promisify } from 'util'
import { getErrorMessage } from '../../shared/utils/error.util'


const execAsync = promisify(exec)

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
    private processes: Map<string, TaskProcess> = new Map()
    private shell: string

    constructor() {
        super()
        this.shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'
    }

    // --- Task Runner (2.2.21) ---

    // Spawn a process using node-pty for terminal integration
    spawn(command: string, args: string[], cwd: string): string {
        const id = Math.random().toString(36).substring(7)

        console.log(`[ProcessService] Spawning: ${command} ${args.join(' ')} in ${cwd}`)

        const ptyProcess = pty.spawn(this.shell, ['-c', `${command} ${args.join(' ')}`], {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd: cwd,
            env: process.env
        })

        const task: TaskProcess = {
            id,
            pid: ptyProcess.pid,
            command,
            args,
            startTime: Date.now(),
            status: 'running',
            cwd,
            ptyProcess
        }

        this.processes.set(id, task)

        // Relay data to frontend
        ptyProcess.onData((data) => {
            this.emit('data', { id, data })
        })

        ptyProcess.onExit(({ exitCode }) => {
            console.log(`[ProcessService] Task ${id} exited with ${exitCode}`)
            task.status = exitCode === 0 ? 'stopped' : 'failed'
            this.emit('exit', { id, code: exitCode })
            // Optional: Keep in history, but remove active reference later?
            // For now, keep it so we can query status
            if (exitCode === 0) {
                this.processes.delete(id)
            }
        })

        return id
    }

    kill(id: string) {
        const task = this.processes.get(id)
        if (task) {
            console.log(`[ProcessService] Killing task ${id}`)
            task.ptyProcess.kill()
            task.status = 'stopped'
            this.processes.delete(id)
            return true
        }
        return false
    }

    getEncoding() {
        // ...
    }

    // --- Script Auto-Discovery (2.2.22) ---

    async scanScripts(rootPath: string): Promise<Record<string, string>> {
        const scripts: Record<string, string> = {}

        try {
            // NPM / Node
            const pkgPath = path.join(rootPath, 'package.json')
            const pkgExists = await fs.access(pkgPath).then(() => true).catch(() => false)

            if (pkgExists) {
                const content = await fs.readFile(pkgPath, 'utf-8')
                const pkg = JSON.parse(content)
                if (pkg.scripts) {
                    Object.assign(scripts, pkg.scripts)
                }
            }

            // Python (basic check for manage.py or similar)
            // Makefile?
        } catch (error) {
            console.error('[ProcessService] Failed to scan scripts:', getErrorMessage(error as Error))
        }

        return scripts
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
        }))
    }

    resize(id: string, cols: number, rows: number) {
        const task = this.processes.get(id)
        if (task) {
            task.ptyProcess.resize(cols, rows)
        }
    }

    write(id: string, data: string) {
        const task = this.processes.get(id)
        if (task) {
            task.ptyProcess.write(data)
        }
    }

    async execute(command: string, cwd?: string): Promise<string> {
        try {
            const { stdout, stderr } = await execAsync(command, { cwd })
            return stdout || stderr || 'Command executed successfully'
        } catch (e) {
            const msg = getErrorMessage(e as Error)
            const stderr = (e as { stderr?: string }).stderr || ''
            return `Error: ${msg}\nStderr: ${stderr}`
        }
    }
}
