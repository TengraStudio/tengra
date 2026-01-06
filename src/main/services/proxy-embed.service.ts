import { ChildProcess, spawn } from 'child_process'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import { promisify } from 'util'
import { ProxyService } from './proxy.service'
import { appLogger } from '../logging/logger'

const execAsync = promisify(require('child_process').exec)

interface ProxyEmbedStatus {
    running: boolean
    pid?: number
    port?: number
    configPath?: string
    binaryPath?: string
    error?: string
}

export class ProxyEmbedService {
    private child: ChildProcess | null = null
    private currentConfigPath: string | undefined
    private currentPort: number | undefined
    private stdoutBuffer = ''
    private stderrBuffer = ''

    constructor(private proxyService: ProxyService) { }

    private getBinaryPath(): string {
        const binName = process.platform === 'win32' ? 'cliproxy-embed.exe' : 'cliproxy-embed'
        return path.join(process.cwd(), 'vendor', 'cliproxyapi', 'cmd', 'cliproxy-embed', binName)
    }

    private getSourceDir(): string {
        return path.join(process.cwd(), 'vendor', 'cliproxyapi', 'cmd', 'cliproxy-embed')
    }

    private async ensureBinary(): Promise<string> {
        const binaryPath = this.getBinaryPath()
        if (fs.existsSync(binaryPath) && !this.shouldRebuild(binaryPath)) {
            return binaryPath
        }

        const sourceDir = this.getSourceDir()
        const outputFlag = process.platform === 'win32' ? '-o cliproxy-embed.exe' : '-o cliproxy-embed'
        const buildCmd = `go build ${outputFlag}`
        const env = {
            ...process.env,
            GOPATH: path.join(os.homedir(), 'go'),
            GOMODCACHE: path.join(os.homedir(), 'go', 'pkg', 'mod')
        }

        const { stdout, stderr } = await execAsync(buildCmd, { cwd: sourceDir, env })
        if (stdout?.trim()) appLogger.info(stdout.trim(), { source: 'proxy-embed:build' })
        if (stderr?.trim()) appLogger.warn(stderr.trim(), { source: 'proxy-embed:build' })

        if (!fs.existsSync(binaryPath)) {
            throw new Error('Failed to build embed binary')
        }
        return binaryPath
    }

    private shouldRebuild(binaryPath: string): boolean {
        if (!fs.existsSync(binaryPath)) {
            return true
        }
        const binaryMtime = fs.statSync(binaryPath).mtimeMs
        const sourceDir = this.getSourceDir()
        const inputs = this.collectBuildInputs(sourceDir)
        return inputs.some((file) => {
            try {
                return fs.statSync(file).mtimeMs > binaryMtime
            } catch {
                return false
            }
        })
    }

    private collectBuildInputs(dir: string): string[] {
        const results: string[] = []
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)
            if (entry.isDirectory()) {
                results.push(...this.collectBuildInputs(fullPath))
                continue
            }
            if (entry.name.endsWith('.go') || entry.name === 'go.mod' || entry.name === 'go.sum') {
                results.push(fullPath)
            }
        }
        return results
    }

    async start(options?: { configPath?: string; port?: number; health?: boolean }): Promise<ProxyEmbedStatus> {
        if (this.child) {
            return this.status()
        }

        const binaryPath = await this.ensureBinary()
        const configPath = options?.configPath || this.proxyService.getConfigPath()
        this.currentConfigPath = configPath
        this.currentPort = options?.port

        // New binary only uses -config, all other settings come from config file
        const args = ['-config', configPath]

        // Ensure config exists
        this.proxyService.prepareAuthWorkDir()
        await this.proxyService.generateConfig(options?.port)

        appLogger.info(`Spawning embedded proxy: ${binaryPath} ${args.join(' ')}`, { source: 'proxy-embed' })
        this.child = spawn(binaryPath, args, {
            cwd: path.dirname(binaryPath),
            env: {
                ...process.env
            },
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        })

        this.child.stdout?.on('data', (data) => {
            this.stdoutBuffer = this.logChunk(this.stdoutBuffer, data.toString(), 'info')
        })

        this.child.stderr?.on('data', (data) => {
            this.stderrBuffer = this.logChunk(this.stderrBuffer, data.toString(), 'error')
        })

        this.child.on('close', (code) => {
            if (this.stdoutBuffer.trim()) {
                appLogger.info(this.stdoutBuffer.trim(), { source: 'proxy-embed' })
                this.stdoutBuffer = ''
            }
            if (this.stderrBuffer.trim()) {
                appLogger.error(this.stderrBuffer.trim(), { source: 'proxy-embed' })
                this.stderrBuffer = ''
            }
            appLogger.warn(`Proxy embed exited with code ${code}`, { source: 'proxy-embed' })
            this.child = null
        })

        return this.status()
    }

    async stop(): Promise<ProxyEmbedStatus> {
        if (this.child) {
            appLogger.info('Stopping embedded proxy...', { source: 'proxy-embed' })
            this.child.kill()
            this.child = null
        }
        return this.status()
    }

    status(): ProxyEmbedStatus {
        return {
            running: !!this.child,
            pid: this.child?.pid,
            port: this.currentPort,
            configPath: this.currentConfigPath,
            binaryPath: this.child ? this.getBinaryPath() : undefined
        }
    }

    private logChunk(buffer: string, chunk: string, level: 'info' | 'error'): string {
        const combined = buffer + chunk
        const lines = combined.split(/\r?\n/)
        const remainder = lines.pop() || ''
        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            if (level === 'error') {
                appLogger.error(trimmed, { source: 'proxy-embed' })
            } else {
                appLogger.info(trimmed, { source: 'proxy-embed' })
            }
        }
        return remainder
    }
}
