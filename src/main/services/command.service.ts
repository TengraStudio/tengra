import { spawn, exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface CommandResult {
    success: boolean
    stdout?: string
    stderr?: string
    exitCode?: number
    error?: string
}

export class CommandService {
    private maxTimeout: number = 60000 // 60 seconds default timeout
    private activeProcesses: Map<string, any> = new Map() // ID -> ChildProcess

    killCommand(id: string): boolean {
        const child = this.activeProcesses.get(id)
        if (child) {
            try {
                // Kill process tree
                const killCmd = `taskkill /PID ${child.pid} /T /F`
                exec(killCmd, (err) => {
                    if (err) console.error('Failed to kill process tree:', err)
                })
                // Also try direct kill safety net
                child.kill()
                this.activeProcesses.delete(id)
                return true
            } catch (err) {
                console.error('Error killing process:', err)
                return false
            }
        }
        return false
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
        // ... (Synchronous/Promisified exec doesn't easily return child before promise, use spawn if ID needed)
        // If ID is provided, better to use spawn logic or accept we can't kill `execAsync` easily without access to child.
        // Actually exec returns a ChildProcess.

        if (options?.id) {
            // If we need to track it, we should use the callback version of exec to get the child object
            return new Promise((resolve) => {
                const child = exec(command, {
                    cwd: options?.cwd || process.cwd(),
                    timeout: options?.timeout || this.maxTimeout,
                    shell: options?.shell || 'powershell.exe',
                    maxBuffer: 10 * 1024 * 1024
                }, (error, stdout, stderr) => {
                    if (options.id) this.activeProcesses.delete(options.id)

                    if (error) {
                        resolve({
                            success: false,
                            stdout: stdout?.trim(),
                            stderr: stderr?.trim(),
                            exitCode: error.code,
                            error: error.message
                        })
                    } else {
                        resolve({
                            success: true,
                            stdout: stdout.trim(),
                            stderr: stderr.trim(),
                            exitCode: 0
                        })
                    }
                })

                if (options.id) this.activeProcesses.set(options.id, child)
            })
        }

        // Default legacy behavior
        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: options?.cwd || process.cwd(),
                timeout: options?.timeout || this.maxTimeout,
                shell: options?.shell || 'powershell.exe',
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer
            })
            // ... same as before
            return {
                success: true,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: 0
            }
        } catch (error: any) {
            return {
                success: false,
                stdout: error.stdout?.trim(),
                stderr: error.stderr?.trim(),
                exitCode: error.code,
                error: error.message
            }
        }
    }

    async executeCommandStream(
        command: string,
        onStdout: (data: string) => void,
        onStderr: (data: string) => void,
        options?: { cwd?: string; timeout?: number; id?: string }
    ): Promise<CommandResult> {
        return new Promise((resolve) => {
            const child = spawn(command, [], {
                cwd: options?.cwd || process.cwd(),
                shell: 'powershell.exe',
                stdio: ['ignore', 'pipe', 'pipe']
            })

            if (options?.id) {
                this.activeProcesses.set(options.id, child)
            }

            let stdout = ''
            let stderr = ''

            const timeout = setTimeout(() => {
                child.kill('SIGTERM')
                if (options?.id) this.activeProcesses.delete(options.id)
                resolve({
                    success: false,
                    stdout,
                    stderr,
                    error: 'Command timed out'
                })
            }, options?.timeout || this.maxTimeout)

            child.stdout?.on('data', (data: Buffer) => {
                const text = data.toString()
                stdout += text
                onStdout(text)
            })

            child.stderr?.on('data', (data: Buffer) => {
                const text = data.toString()
                stderr += text
                onStderr(text)
            })

            child.on('close', (code) => {
                clearTimeout(timeout)
                if (options?.id) this.activeProcesses.delete(options.id)
                resolve({
                    success: code === 0,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    exitCode: code ?? undefined
                })
            })

            child.on('error', (error) => {
                clearTimeout(timeout)
                if (options?.id) this.activeProcesses.delete(options.id)
                resolve({
                    success: false,
                    stdout,
                    stderr,
                    error: error.message
                })
            })
        })
    }

    async getSystemInfo(): Promise<any> {
        const [hostname, username, osInfo] = await Promise.all([
            this.executeCommand('hostname'),
            this.executeCommand('$env:USERNAME'),
            this.executeCommand('[System.Environment]::OSVersion.VersionString')
        ])

        return {
            hostname: hostname.stdout,
            username: username.stdout,
            os: osInfo.stdout,
            cwd: process.cwd(),
            platform: process.platform,
            arch: process.arch
        }
    }
}
