
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { appLogger } from '../../logging/logger'
import { SettingsService } from '../settings.service'
import { SecurityService } from '../security.service'
import { DataService } from '../data/data.service'
import { app } from 'electron'
import { JsonObject } from '../../../shared/types/common' 

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

        // Generate YAML config for the proxy binary (separate from settings.json!)
        const proxyConfigPath = await this.generateProxyConfigFile(this.currentPort, this.tempAuthDir || undefined)

        this.child = spawn(binaryPath, ['-config', proxyConfigPath], {
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

        // Before cleanup, sync any new auth files from temp to real auth dir
        await this.syncAuthFilesFromTemp()

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

    /**
     * Sync auth files from temp directory to the real auth directory.
     * This ensures OAuth tokens saved by the proxy are persisted and encrypted correctly.
     */
    async syncAuthFilesFromTemp(force: boolean = false): Promise<void> {
        if (!this.tempAuthDir || !fs.existsSync(this.tempAuthDir)) return

        const realAuthDir = this.getAuthWorkDir()
        console.log('[ProxyProcessManager] Syncing auth files from temp to:', realAuthDir)

        try {
            const tempFiles = fs.readdirSync(this.tempAuthDir)

            for (const file of tempFiles) {
                if (!file.endsWith('.json')) continue

                const tempPath = path.join(this.tempAuthDir, file)
                const realPath = path.join(realAuthDir, file)

                try {
                    const tempStat = fs.statSync(tempPath)

                    // Check if the temp file is newer than the existing one
                    let shouldSync = true
                    if (!force && fs.existsSync(realPath)) {
                        const realStat = fs.statSync(realPath)
                        // Only sync if temp file is newer
                        shouldSync = tempStat.mtime > realStat.mtime
                    }

                    if (shouldSync) {
                        // Read the temp file (it's in plain format from proxy)
                        const content = fs.readFileSync(tempPath, 'utf8')
                        const data = JSON.parse(content) as JsonObject

                        // Encrypt and save to real auth dir using same format as AuthService
                        if (this.securityService) {
                            const encrypted = this.securityService.encryptSync(JSON.stringify(data))
                            const wrapper = {
                                provider: file.replace('.json', ''),
                                token: encrypted,
                                updatedAt: Date.now()
                            }
                            fs.writeFileSync(realPath, JSON.stringify(wrapper, null, 2), 'utf8')
                            console.log(`[ProxyProcessManager] Synced and encrypted auth file: ${file}`)
                        } else {
                            // Fallback: copy as-is
                            fs.copyFileSync(tempPath, realPath)
                            console.log(`[ProxyProcessManager] Synced auth file (no encryption): ${file}`)
                        }
                    }
                } catch (e) {
                    console.error(`[ProxyProcessManager] Failed to sync auth file ${file}:`, e)
                }
            }
        } catch (e) {
            console.error('[ProxyProcessManager] Failed to sync auth files:', e)
        }
    }

    /**
     * Manually trigger auth file sync (e.g., after OAuth callback)
     */
    async forceSyncAuthFiles(): Promise<void> {
        return this.syncAuthFilesFromTemp()
    }

    /**
     * Get the current temp auth directory path
     */
    getTempAuthDir(): string | null {
        return this.tempAuthDir
    }

    getStatus(): ProxyEmbedStatus {
        return { running: !!this.child, pid: this.child?.pid, port: this.currentPort }
    }

    private getBinaryPath(): string {
        const binName = process.platform === 'win32' ? 'cliproxy-embed.exe' : 'cliproxy-embed'
        return path.join(process.cwd(), 'vendor', 'cliproxyapi', 'cmd', 'cliproxy-embed', binName)
    }

    private logProxyChunk(currentBuffer: string, chunk: string, defaultLevel: 'info' | 'error'): string {
        const buffer = currentBuffer + chunk
        const lines = buffer.split(/\r?\n/)
        const remainder = lines.pop() || ''
        for (const line of lines) {
            if (!line.trim()) continue

            // Try to detect level from structured log
            let level: 'info' | 'warning' | 'error' = defaultLevel
            if (line.includes('level=info') || line.includes('[INFO]')) level = 'info'
            else if (line.includes('level=warning') || line.includes('level=warn') || line.includes('[WARN]')) level = 'warning'
            else if (line.includes('level=error') || line.includes('level=fatal') || line.includes('[ERROR]')) level = 'error'

            // Special case: Go logs often go to stderr but are just info
            if (defaultLevel === 'error' && (level === 'info' || level === 'warning')) {
                // It was on stderr but content says info/warn -> trust content
            } else if (defaultLevel === 'error' && !line.toLowerCase().includes('error') && !line.toLowerCase().includes('fatal')) {
                // It was on stderr but doesn't look like an error -> downgrade to info to avoid scary red logs
                level = 'info'
            }

            if (level === 'error') appLogger.error('Proxy', line.trim())
            else if (level === 'warning') appLogger.warn('Proxy', line.trim())
            else appLogger.info('Proxy', line.trim())

            // Auto-sync triggering
            if (line.includes('auth file changed')) {
                console.log('[ProxyProcessManager] Detected auth file change, triggering sync in 500ms...')
                // Run in background to not block logging loop, with a small delay to ensure disk flush
                setTimeout(() => {
                    this.syncAuthFilesFromTemp(true).catch(e => console.error('[ProxyProcessManager] Auto-sync failed:', e))
                }, 500)
            }
        }
        return remainder
    }

    async prepareTempAuthDir() {
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

                            // The proxy expects the internal "cliproxy format" (usually { access_token: ... })
                            // Or the decrypted payload of our own format.
                            // If we decrypted it and it's our format { provider, token, updatedAt },
                            // we should probably just save the token itself if it's GitHub/Copilot, 
                            // or keep the structure if it's already a complex object (like Gemini session).

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

    private readAuthFile(filePath: string): JsonObject | null {
        try {
            const content = fs.readFileSync(filePath, 'utf8')
            const json = JSON.parse(content) as JsonObject

            if (this.securityService) {
                // Handle new Orbit format { provider, token, updatedAt }
                if (json.token && typeof json.token === 'string') {
                    const decrypted = this.securityService.decryptSync(json.token)
                    if (decrypted) {
                        try {
                            // If the decrypted content is JSON itself (like Gemini session), parse it
                            return JSON.parse(decrypted) as JsonObject
                        } catch {
                            // Otherwise it's a raw string (like a GitHub token)
                            // The proxy binary often expects { "access_token": "..." } or similar if it's a raw token file
                            // But for simple "cliproxy" usage, it depends on the provider.
                            // Let's return the string-as-token if it's not JSON.
                            return { access_token: decrypted } as JsonObject
                        }
                    }
                }

                // Handle old/legacy format { encryptedPayload, version }
                if (json.encryptedPayload) {
                    const encryptedPayload = typeof json.encryptedPayload === 'string' ? json.encryptedPayload : ''
                    const decrypted = this.securityService.decryptSync(encryptedPayload)
                    if (!decrypted) {
                        console.warn(`[ProxyProcessManager] Deleting corrupted auth file: ${path.basename(filePath)}`)
                        try { fs.unlinkSync(filePath) } catch (e) { /* ignore */ }
                        return null
                    }
                    return JSON.parse(decrypted) as JsonObject
                }
            }
            return json
        } catch {
            // console.warn('[ProxyProcessManager] Failed to read/decrypt auth file:', filePath)
            return null
        }
    }

    /**
     * Generate a YAML config file for the cliproxy binary.
     * This is SEPARATE from settings.json to avoid corruption.
     */
    async generateProxyConfigFile(port: number, overrideAuthDir?: string): Promise<string> {
        const settings = this.settingsService.getSettings()
        const finalAuthDir = overrideAuthDir || this.getAuthWorkDir()
        const authDir = finalAuthDir.replace(/\\/g, '/')

        let proxyKey = settings.proxy?.key
        if (!proxyKey) {
            console.warn('[ProxyProcessManager] Proxy Key missing in settings, process might not auth correctly.')
            proxyKey = ''
        }

        // Build YAML config for the proxy binary
        const yamlConfig = `host: "127.0.0.1"
port: ${port}
auth-dir: "${authDir}"
api-keys:
  - "${proxyKey}"
remote-management:
  secret-key: "${proxyKey}"
debug: true
logging-to-file: false
`

        // Write to proxy-config.yaml (not settings.json!)
        const configDir = this.dataService.getPath('config')
        const configPath = path.join(configDir, 'proxy-config.yaml')

        fs.writeFileSync(configPath, yamlConfig, 'utf8')
        console.log('[ProxyProcessManager] Generated proxy config at:', configPath)

        // Update settings with just the basic proxy info (no YAML-specific fields)
        this.settingsService.saveSettings({
            proxy: {
                enabled: settings.proxy?.enabled ?? false,
                url: settings.proxy?.url || `http://127.0.0.1:${port}/v1`,
                key: proxyKey,
                authStoreKey: settings.proxy?.authStoreKey
            }
        })

        return configPath
    }

    /**
     * @deprecated Use generateProxyConfigFile instead
     */
    async generateConfig(port: number, overrideAuthDir?: string) {
        // Kept for backwards compatibility - just calls the new method
        await this.generateProxyConfigFile(port, overrideAuthDir)
    }
}
