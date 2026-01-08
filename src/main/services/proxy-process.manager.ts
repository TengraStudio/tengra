
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { appLogger } from '../logging/logger'
import { SettingsService } from './settings.service'
import { SecurityService } from './security.service'
import { DataService } from './data.service'
import { app } from 'electron'

export interface ProxyEmbedStatus {
    running: boolean
    pid?: number
    port?: number
    configPath?: string
    binaryPath?: string
    error?: string
}

export class ProxyProcessManager {
    private child: ChildProcess | null = null
    private currentPort: number = 8317
    private stdoutBuffer = ''
    private stderrBuffer = ''
    private tempAuthDir: string | null = null

    constructor(
        private settingsService: SettingsService,
        private dataService: DataService,
        private securityService: SecurityService
    ) { }

    async start(options?: { port?: number }): Promise<ProxyEmbedStatus> {
        if (this.child) {
            return this.getStatus()
        }

        const binaryPath = this.getBinaryPath()
        console.log('[ProxyProcessManager] Binary path:', binaryPath)

        if (!fs.existsSync(binaryPath)) {
            console.error('[ProxyProcessManager] Binary not found at:', binaryPath)
            return { running: false, error: `Binary not found at ${binaryPath}` }
        }

        this.currentPort = options?.port || 8317

        // Secure Storage: Setup temp dir and decrypt files
        await this.prepareTempAuthDir()

        // Generate config dynamically
        await this.generateConfig(this.currentPort, this.tempAuthDir || undefined)

        const settingsPath = this.settingsService.getSettingsPath()

        this.child = spawn(binaryPath, ['-config', settingsPath], {
            cwd: path.dirname(binaryPath),
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        })

        this.child.stdout?.on('data', d => this.stdoutBuffer = this.logProxyChunk(this.stdoutBuffer, d.toString(), 'info'))
        this.child.stderr?.on('data', d => this.stderrBuffer = this.logProxyChunk(this.stderrBuffer, d.toString(), 'error'))
        this.child.on('close', code => {
            this.child = null
            appLogger.warn('Proxy', `Proxy exited: ${code}`)
            console.log('[ProxyProcessManager] Proxy process exited with code:', code)
        })

        console.log('[ProxyProcessManager] Proxy started with PID:', this.child.pid)
        return this.getStatus()
    }

    async stop(): Promise<ProxyEmbedStatus> {
        if (this.child) {
            this.child.kill()
            this.child = null
        }

        // Cleanup temp dir
        if (this.tempAuthDir) {
            try {
                fs.rmSync(this.tempAuthDir, { recursive: true, force: true })
            } catch (e) {
                console.error('[ProxyProcessManager] Failed to cleanup temp auth dir:', e)
            }
            this.tempAuthDir = null
        }

        return this.getStatus()
    }

    getStatus(): ProxyEmbedStatus {
        return { running: !!this.child, pid: this.child?.pid, port: this.currentPort }
    }

    private getBinaryPath(): string {
        const binName = process.platform === 'win32' ? 'cliproxy-embed.exe' : 'cliproxy-embed'
        return path.join(process.cwd(), 'vendor', 'cliproxyapi', 'cmd', 'cliproxy-embed', binName)
    }

    private logProxyChunk(buffer: string, chunk: string, level: 'info' | 'error'): string {
        const lines = (buffer + chunk).split(/\r?\n/)
        const remainder = lines.pop() || ''
        for (const line of lines) if (line.trim()) (appLogger[level] as any)('Proxy', line.trim())
        return remainder
    }

    private async prepareTempAuthDir() {
        try {
            this.tempAuthDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-proxy-auth-'))
            const realAuthDir = this.getAuthWorkDir()
            if (fs.existsSync(realAuthDir)) {
                const files = fs.readdirSync(realAuthDir)
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        try {
                            // Decrypt and copy
                            const json = this.readAuthFile(path.join(realAuthDir, file))
                            if (!json) continue

                            const textToSave = JSON.stringify(json)
                            fs.writeFileSync(path.join(this.tempAuthDir, file), textToSave)
                        } catch (e) {
                            console.warn('[ProxyProcessManager] Failed to decrypt/copy auth file:', file, e)
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[ProxyProcessManager] Failed to create temp auth dir:', e)
        }
    }

    private getAuthWorkDir(): string {
        if (this.dataService) {
            return this.dataService.getPath('auth')
        }
        return path.join(app.getPath('userData'), 'auth')
    }

    private readAuthFile(filePath: string): any | null {
        try {
            const content = fs.readFileSync(filePath, 'utf8')
            let json = JSON.parse(content)

            if (json.encryptedPayload && this.securityService) {
                const decrypted = this.securityService.decryptSync(json.encryptedPayload)
                json = JSON.parse(decrypted)
            }
            return json
        } catch (e) {
            // console.warn('[ProxyProcessManager] Failed to read/decrypt auth file:', filePath, e)
            return null
        }
    }

    private async generateConfig(port: number, overrideAuthDir?: string) {
        const settings = this.settingsService.getSettings()
        const finalAuthDir = overrideAuthDir || this.getAuthWorkDir()
        const authDir = finalAuthDir.replace(/\\/g, '/')

        // We access proxy key via settings, assuming it's already set by ProxyService or we might need to expose a helper
        // ProxyService ensures keys exist in constructor. We can assume they are there or delegate key generation?
        // For now, let's assume they exist or read from settings safely.
        let proxyKey = settings.proxy?.key
        if (!proxyKey) {
            // Should not happen if ProxyService is initialized, but safe fallback
            console.warn('[ProxyProcessManager] Proxy Key missing in settings, process might not auth correctly.')
            proxyKey = ''
        }

        this.settingsService.saveSettings({
            proxy: {
                ...(settings.proxy || {}),
                host: "127.0.0.1",
                port: port,
                "auth-dir": authDir,
                "api-keys": [proxyKey],
                "remote-management": {
                    "secret-key": proxyKey
                },
                debug: true,
                "logging-to-file": false
            }
        } as any)
    }
}
