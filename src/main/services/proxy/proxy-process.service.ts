
import { ChildProcess, spawn } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { appLogger } from '@main/logging/logger'
import { DataService } from '@main/services/data/data.service'
import { AuthService } from '@main/services/security/auth.service'
import { SecurityService } from '@main/services/security/security.service'
import { SettingsService } from '@main/services/system/settings.service'
import { JsonObject } from '@shared/types/common'


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
    private startupTime: number = Date.now()

    constructor(
        private settingsService: SettingsService,
        private dataService: DataService,
        private securityService: SecurityService,
        private authService: AuthService
    ) { }

    async start(options?: { port?: number }): Promise<ProxyEmbedStatus> {
        if (this.child) {
            return this.getStatus()
        }

        const binaryPath = this.getBinaryPath()
        appLogger.info('Proxy', `Binary path: ${binaryPath}`)

        const exists = await fs.promises.access(binaryPath).then(() => true).catch(() => false)
        if (!exists) {
            appLogger.error('Proxy', `Binary not found at: ${binaryPath}`)
            return { running: false, error: `Binary not found at ${binaryPath}` }
        }

        this.currentPort = options?.port ?? 8317

        // Secure Storage: Setup temp dir and decrypt files
        await this.prepareTempAuthDir()

        // Generate YAML config for the proxy binary (separate from settings.json!)
        const proxyConfigPath = await this.generateProxyConfigFile(this.currentPort, this.tempAuthDir ?? undefined)

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
        })

        appLogger.info('Proxy', `Proxy started with PID: ${this.child.pid}`)
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
                await fs.promises.rm(this.tempAuthDir, { recursive: true, force: true })
            } catch (e) {
                appLogger.error('Proxy', `Failed to cleanup temp auth dir: ${this.tempAuthDir}. Error: ${e}`)
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
        if (!this.tempAuthDir) { return }
        const exists = await fs.promises.access(this.tempAuthDir).then(() => true).catch(() => false)
        if (!exists) { return }


        appLogger.info('Proxy', `Syncing auth files from temp and saving to Database`)

        try {
            const tempFiles = await fs.promises.readdir(this.tempAuthDir)
            const dbTokens = await this.authService.getAllFullTokens()

            for (const file of tempFiles) {
                if (!file.endsWith('.json')) { continue }
                await this.syncSingleFile(file, dbTokens, force)
            }
        } catch (e) {
            appLogger.error('Proxy', `Failed to process temp auth files: ${e}`)
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async syncSingleFile(file: string, dbTokens: any[], force: boolean) {
        if (!this.tempAuthDir) { return }
        const tempPath = path.join(this.tempAuthDir, file)
        const provider = file.replace('.json', '')

        try {
            const tempStat = await fs.promises.stat(tempPath)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dbToken = dbTokens.find((t: any) => t.provider === provider)

            // Only sync if temp file is newer than DB record
            if (!force && dbToken && tempStat.mtime.getTime() <= (dbToken.updatedAt ?? 0)) {
                return
            }

            // If DB token is missing, this might be a stale file we populated at startup
            if (!dbToken && tempStat.mtime.getTime() <= this.startupTime + 5000) {
                try { await fs.promises.unlink(tempPath) } catch { /* ignore */ }
                return
            }

            // Read the temp file
            const content = await fs.promises.readFile(tempPath, 'utf8')

            // Save directly to Database
            await this.authService.saveToken(provider, content)
            appLogger.info('Proxy', `Saved auth token for ${provider} directly to Database`)

        } catch (e) {
            appLogger.error('Proxy', `Failed to save auth token ${file} to DB: ${e}`)
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
        const remainder = lines.pop() ?? ''
        for (const line of lines) {
            if (!line.trim()) { continue }
            this.processProxyLogLine(line, defaultLevel)
        }
        return remainder
    }

    private processProxyLogLine(line: string, defaultLevel: 'info' | 'error') {
        const level = this.detectLogLevel(line, defaultLevel)

        if (level === 'error') {
            appLogger.error('Proxy', line.trim())
        } else if (level === 'warning') {
            appLogger.warn('Proxy', line.trim())
        } else {
            appLogger.info('Proxy', line.trim())
        }

        // Auto-sync triggering
        if (line.includes('auth file changed')) {
            appLogger.info('Proxy', 'Detected auth file change, triggering sync in 500ms...')
            // Run in background to not block logging loop, with a small delay to ensure disk flush
            setTimeout(() => {
                this.syncAuthFilesFromTemp(true).catch(e => appLogger.error('Proxy', `Auto-sync failed: ${e}`))
            }, 500)
        }
    }

    private detectLogLevel(line: string, defaultLevel: 'info' | 'error'): 'info' | 'warning' | 'error' {
        if (/level=info|\[INFO\]/i.test(line)) { return 'info' }
        if (/level=warn(ing)?|\[WARN\]/i.test(line)) { return 'warning' }
        if (/level=error|\[ERROR\]|level=fatal/i.test(line)) { return 'error' }

        // Downgrade harmless stderr logs
        if (defaultLevel === 'error' && !/error|fatal/i.test(line)) {
            return 'info'
        }
        return defaultLevel
    }

    async prepareTempAuthDir() {
        try {
            this.tempAuthDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'orbit-proxy-auth-'))
            this.startupTime = Date.now() // Record when we engaged the temp dir

            const dbTokens = await this.authService.getAllFullTokens()
            let count = 0
            for (const token of dbTokens) {
                await this.populateTempFile(token)
                count++
            }
            appLogger.info('Proxy', `Populated temp auth dir with ${count} tokens from Database`)
        } catch (e) {
            appLogger.error('Proxy', `Failed to create temp auth dir: ${e}`)
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async populateTempFile(token: any) {
        if (!this.tempAuthDir) { return }
        try {
            const fileName = `${token.provider}.json`
            const tempPath = path.join(this.tempAuthDir, fileName)

            // Skip if file already exists
            if (fs.existsSync(tempPath)) { return }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let data: any
            if (token.accessToken?.startsWith('{')) {
                try { data = JSON.parse(token.accessToken) } catch { data = { access_token: token.accessToken } }
            } else {
                data = { access_token: token.accessToken, session_token: token.sessionToken, refresh_token: token.refreshToken }
            }

            await fs.promises.writeFile(tempPath, JSON.stringify(data), 'utf8')
            // Log suppressed to reduce noise
        } catch (e) {
            appLogger.error('Proxy', `Failed to populate temp auth dir with DB token ${token.provider}: ${e}`)
        }
    }

    private getAuthWorkDir(): string {
        return this.dataService.getPath('auth')
    }

    private async readAuthFile(filePath: string): Promise<JsonObject | null> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8')
            const json = JSON.parse(content) as JsonObject

            if (json.token && typeof json.token === 'string') {
                return this.decryptToken(json.token)
            }
            if (json.encryptedPayload) {
                return this.decryptLegacyToken(filePath, json.encryptedPayload as string)
            }
            return json
        } catch {
            return null
        }
    }

    private decryptToken(token: string): JsonObject {
        const decrypted = this.securityService.decryptSync(token)
        if (!decrypted) { return { access_token: token } as JsonObject }

        try {
            return JSON.parse(decrypted) as JsonObject
        } catch {
            return { access_token: decrypted } as JsonObject
        }
    }

    private async decryptLegacyToken(filePath: string, encryptedPayload: string): Promise<JsonObject | null> {
        const decrypted = this.securityService.decryptSync(encryptedPayload)
        if (!decrypted) {
            appLogger.warn('Proxy', `Deleting corrupted auth file: ${path.basename(filePath)}`)
            try { await fs.promises.unlink(filePath) } catch { /* ignore */ }
            return null
        }
        return JSON.parse(decrypted) as JsonObject
    }

    /**
     * Generate a YAML config file for the cliproxy binary.
     * This is SEPARATE from settings.json to avoid corruption.
     */
    async generateProxyConfigFile(port: number, overrideAuthDir?: string): Promise<string> {
        const settings = this.settingsService.getSettings()
        const finalAuthDir = overrideAuthDir ?? this.getAuthWorkDir()
        const authDir = finalAuthDir.replace(/\\/g, '/')

        const proxyKey = settings.proxy?.key ?? ''

        const yamlConfig = `host: "127.0.0.1"
port: ${port}
auth-dir: "${authDir}"
api-keys:
  - "${proxyKey}"
remote-management:
  secret-key: "${proxyKey}"
debug: false
logging-to-file: false
`

        // Write to proxy-config.yaml (not settings.json!)
        const configDir = this.dataService.getPath('config')
        const configPath = path.join(configDir, 'proxy-config.yaml')

        await fs.promises.writeFile(configPath, yamlConfig, 'utf8')
        appLogger.info('Proxy', `Generated proxy config at: ${configPath}`)

        // Update settings with just the basic proxy info (no YAML-specific fields)
        await this.settingsService.saveSettings({
            proxy: {
                enabled: settings.proxy?.enabled ?? false,
                url: settings.proxy?.url ?? `http://127.0.0.1:${port}/v1`,
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
