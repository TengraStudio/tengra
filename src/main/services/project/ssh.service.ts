import * as crypto from 'crypto'
import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as net from 'net'
import * as path from 'path'

import { appLogger } from '@main/logging/logger'
import { SSHExecOptions, SSHFile, SSHPackageInfo, SSHSystemStats } from '@shared/types/ssh'
import { getErrorMessage } from '@shared/utils/error.util'
import { safeStorage } from 'electron'
import { Client, ClientChannel } from 'ssh2'

export interface SSHConnection {
    id: string
    name: string
    host: string
    port: number
    username: string
    authType: 'password' | 'key'
    password?: string
    privateKey?: string
    passphrase?: string
    connected: boolean
    // Enhanced fields
    lastConnected?: number
    connectionCount?: number
    isFavorite?: boolean
    tags?: string[]
    jumpHost?: string // For SSH tunneling through another host
    forwardAgent?: boolean
    keepaliveInterval?: number
    [key: string]: string | number | boolean | string[] | undefined
}

export interface PortForward {
    id: string
    connectionId: string
    type: 'local' | 'remote' | 'dynamic'
    localHost: string
    localPort: number
    remoteHost: string
    remotePort: number
    active: boolean
}

export interface SSHConnectionStats {
    bytesReceived: number
    bytesSent: number
    commandsExecuted: number
    connectedAt: number
    lastActivity: number
}

interface ShellSession {
    stream: ClientChannel
    onData: (data: string) => void
    onExit: () => void
}

export class SSHService extends EventEmitter {
    private connections: Map<string, Client> = new Map()
    private connectionDetails: Map<string, SSHConnection> = new Map()
    private connectionStats: Map<string, SSHConnectionStats> = new Map()
    private shellSessions: Map<string, ShellSession> = new Map()
    private portForwards: Map<string, PortForward> = new Map()
    private keepaliveTimers: Map<string, NodeJS.Timeout> = new Map()
    private storagePath: string
    private initPromise: Promise<void> | null = null

    constructor(storagePath: string) {
        super()
        this.storagePath = storagePath
    }

    /**
     * Encrypt sensitive data using Electron's safeStorage
     */
    private encryptCredential(value: string): string {
        if (!value || !safeStorage.isEncryptionAvailable()) { return value }
        try {
            return safeStorage.encryptString(value).toString('base64')
        } catch {
            return value
        }
    }

    /**
     * Decrypt sensitive data using Electron's safeStorage
     */
    private decryptCredential(value: string): string {
        if (!value || !safeStorage.isEncryptionAvailable()) { return value }
        try {
            const buffer = Buffer.from(value, 'base64')
            return safeStorage.decryptString(buffer)
        } catch {
            return value
        }
    }

    private get profilesPath(): string {
        return path.join(this.storagePath, 'ssh-profiles.json')
    }

    private async ensureInitialization(): Promise<void> {
        if (this.initPromise) { return this.initPromise }
        this.initPromise = (async () => {
            try {
                await fs.promises.mkdir(this.storagePath, { recursive: true })
                try {
                    await fs.promises.access(this.profilesPath)
                } catch {
                    await fs.promises.writeFile(this.profilesPath, JSON.stringify([], null, 2))
                }
            } catch (error) {
                appLogger.error('SSHService', `Initialization failed: ${getErrorMessage(error as Error)}`)
                this.initPromise = null
                throw error
            }
        })()
        return this.initPromise
    }

    async getSavedProfiles(): Promise<SSHConnection[]> {
        try {
            await this.ensureInitialization()
            try {
                await fs.promises.access(this.profilesPath)
            } catch {
                return []
            }
            const content = await fs.promises.readFile(this.profilesPath, 'utf-8')
            return JSON.parse(content) as SSHConnection[]
        } catch (error) {
            appLogger.error('SSHService', `Failed to load SSH profiles: ${getErrorMessage(error as Error)}`)
            return []
        }
    }

    async saveProfile(profile: SSHConnection): Promise<boolean> {
        try {
            await this.ensureInitialization()
            const profiles = await this.getSavedProfiles()
            const index = profiles.findIndex(p => p.id === profile.id)

            // Encrypt sensitive credentials
            const safeProfile = { ...profile }
            if (safeProfile.password) {
                safeProfile.password = this.encryptCredential(safeProfile.password)
            }
            if (safeProfile.passphrase) {
                safeProfile.passphrase = this.encryptCredential(safeProfile.passphrase)
            }

            if (index >= 0) {
                profiles[index] = safeProfile
            } else {
                profiles.push(safeProfile)
            }

            await fs.promises.writeFile(this.profilesPath, JSON.stringify(profiles, null, 2))
            return true
        } catch (error) {
            appLogger.error('SSHService', `Failed to save SSH profile: ${getErrorMessage(error as Error)}`)
            return false
        }
    }

    /**
     * Get a profile with decrypted credentials
     */
    async getProfileWithCredentials(id: string): Promise<SSHConnection | null> {
        const profiles = await this.getSavedProfiles()
        const profile = profiles.find(p => p.id === id)
        if (!profile) { return null }

        // Decrypt credentials
        const decrypted = { ...profile }
        if (decrypted.password) {
            decrypted.password = this.decryptCredential(decrypted.password)
        }
        if (decrypted.passphrase) {
            decrypted.passphrase = this.decryptCredential(decrypted.passphrase)
        }
        return decrypted
    }

    /**
     * Toggle favorite status for a profile
     */
    async toggleFavorite(id: string): Promise<boolean> {
        const profiles = await this.getSavedProfiles()
        const index = profiles.findIndex(p => p.id === id)
        if (index === -1) { return false }

        profiles[index].isFavorite = !profiles[index].isFavorite
        await fs.promises.writeFile(this.profilesPath, JSON.stringify(profiles, null, 2))
        return true
    }

    /**
     * Get favorite profiles
     */
    async getFavorites(): Promise<SSHConnection[]> {
        const profiles = await this.getSavedProfiles()
        return profiles.filter(p => p.isFavorite)
    }

    /**
     * Get recent connections sorted by last connected time
     */
    async getRecentConnections(limit: number = 10): Promise<SSHConnection[]> {
        const profiles = await this.getSavedProfiles()
        return profiles
            .filter(p => p.lastConnected)
            .sort((a, b) => (b.lastConnected ?? 0) - (a.lastConnected ?? 0))
            .slice(0, limit)
    }

    /**
     * Add tags to a profile
     */
    async setProfileTags(id: string, tags: string[]): Promise<boolean> {
        const profiles = await this.getSavedProfiles()
        const index = profiles.findIndex(p => p.id === id)
        if (index === -1) { return false }

        profiles[index].tags = tags
        await fs.promises.writeFile(this.profilesPath, JSON.stringify(profiles, null, 2))
        return true
    }

    /**
     * Search profiles by name, host, or tags
     */
    async searchProfiles(query: string): Promise<SSHConnection[]> {
        const profiles = await this.getSavedProfiles()
        const q = query.toLowerCase()
        return profiles.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.host.toLowerCase().includes(q) ||
            p.username.toLowerCase().includes(q) ||
            p.tags?.some(t => t.toLowerCase().includes(q))
        )
    }

    async deleteProfile(id: string): Promise<boolean> {
        try {
            const profiles = await this.getSavedProfiles()
            const filtered = profiles.filter(p => p.id !== id)
            await fs.promises.writeFile(this.profilesPath, JSON.stringify(filtered, null, 2))
            return true
        } catch (error) {
            appLogger.error('SSHService', `Failed to delete SSH profile: ${getErrorMessage(error as Error)}`)
            return false
        }
    }

    async connect(config: SSHConnection): Promise<{ success: boolean; error?: string }> {
        // Check if already connected
        if (this.connections.has(config.id)) {
            return { success: true }
        }

        let privateKeyContent: Buffer | undefined
        try {
            if (config.privateKey) {
                privateKeyContent = await fs.promises.readFile(config.privateKey)
            }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) }
        }

        return new Promise((resolve) => {
            const conn = new Client()
            const keepaliveInterval = config.keepaliveInterval ?? 30000

            conn.on('ready', () => {
                (async () => {
                    this.connections.set(config.id, conn)
                    this.connectionDetails.set(config.id, { ...config, connected: true })

                    // Initialize connection stats
                    this.connectionStats.set(config.id, {
                        bytesReceived: 0,
                        bytesSent: 0,
                        commandsExecuted: 0,
                        connectedAt: Date.now(),
                        lastActivity: Date.now()
                    })

                    // Setup keepalive
                    const timer = setInterval(() => {
                        conn.exec('echo keepalive', () => { })
                    }, keepaliveInterval)
                    this.keepaliveTimers.set(config.id, timer)

                    // Update profile with connection history
                    try {
                        const profiles = await this.getSavedProfiles()
                        const profileIndex = profiles.findIndex(p => p.id === config.id)
                        if (profileIndex >= 0) {
                            profiles[profileIndex].lastConnected = Date.now()
                            profiles[profileIndex].connectionCount = (profiles[profileIndex].connectionCount ?? 0) + 1
                            await fs.promises.writeFile(this.profilesPath, JSON.stringify(profiles, null, 2))
                        }
                    } catch {
                        // Ignore error updating history
                    }

                    this.emit('connected', config.id)
                    resolve({ success: true })
                })().catch(err => {
                    appLogger.error('SSHService', `Error in ready handler for ${config.id}: ${getErrorMessage(err as Error)}`)
                    resolve({ success: false, error: getErrorMessage(err as Error) })
                })
            }).on('error', (err: Error) => {
                this.emit('error', { id: config.id, message: err.message })
                resolve({ success: false, error: err.message })
            }).on('close', () => {
                // Cleanup
                const timer = this.keepaliveTimers.get(config.id)
                if (timer) { clearInterval(timer) }
                this.keepaliveTimers.delete(config.id)
                this.connections.delete(config.id)
                this.connectionDetails.delete(config.id)
                this.connectionStats.delete(config.id)
                this.shellSessions.delete(config.id)
                this.emit('disconnected', config.id)
            })

            try {
                // Decrypt credentials if needed
                const password = config.password ? this.decryptCredential(config.password) : undefined
                const passphrase = config.passphrase ? this.decryptCredential(config.passphrase) : undefined

                conn.connect({
                    host: config.host,
                    port: config.port,
                    username: config.username,
                    password,
                    privateKey: privateKeyContent,
                    passphrase,
                    keepaliveInterval,
                    keepaliveCountMax: 3,
                    readyTimeout: 20000,
                    agentForward: config.forwardAgent
                })
            } catch (error) {
                resolve({ success: false, error: getErrorMessage(error as Error) })
            }
        })
    }

    /**
     * Get connection statistics
     */
    getConnectionStats(connectionId: string): SSHConnectionStats | null {
        return this.connectionStats.get(connectionId) ?? null
    }

    async disconnect(connectionId: string): Promise<boolean> {
        const conn = this.connections.get(connectionId)
        if (conn) {
            conn.end()
            this.connections.delete(connectionId)
            this.connectionDetails.delete(connectionId)
            return true
        }
        return false
    }

    getAllConnections(): SSHConnection[] {
        return Array.from(this.connectionDetails.values())
    }

    isConnected(connectionId: string): boolean {
        return this.connections.has(connectionId)
    }

    async executeCommand(connectionId: string, command: string, options?: SSHExecOptions): Promise<{ stdout: string; stderr: string; code: number }> {
        const conn = this.connections.get(connectionId)
        if (!conn) { throw new Error('Not connected') }

        // Update stats
        const stats = this.connectionStats.get(connectionId)
        if (stats) {
            stats.commandsExecuted++
            stats.lastActivity = Date.now()
            stats.bytesSent += command.length
        }

        return new Promise((resolve, reject) => {
            const execOptions: Record<string, unknown> = {}
            if (options?.env) { execOptions.env = options.env }
            if (options?.pty) { execOptions.pty = true }

            conn.exec(command, execOptions, (err, stream) => {
                if (err) { return reject(err) }
                let stdout = ''
                let stderr = ''

                // Handle timeout
                let timeout: NodeJS.Timeout | null = null
                if (options?.timeout) {
                    timeout = setTimeout(() => {
                        stream.close()
                        reject(new Error('Command timed out'))
                    }, options.timeout)
                }

                stream.on('close', (code: number) => {
                    if (timeout) { clearTimeout(timeout) }
                    // Update bytes received
                    if (stats) {
                        stats.bytesReceived += stdout.length + stderr.length
                    }
                    resolve({ stdout, stderr, code })
                }).on('data', (data: Buffer | string) => {
                    stdout += data.toString()
                }).stderr.on('data', (data: Buffer | string) => {
                    stderr += data.toString()
                })
            })
        })
    }

    /**
     * Execute command with streaming output
     */
    async executeCommandStreaming(
        connectionId: string,
        command: string,
        onStdout: (data: string) => void,
        onStderr: (data: string) => void,
        options?: SSHExecOptions
    ): Promise<number> {
        const conn = this.connections.get(connectionId)
        if (!conn) { throw new Error('Not connected') }

        const stats = this.connectionStats.get(connectionId)
        if (stats) {
            stats.commandsExecuted++
            stats.lastActivity = Date.now()
        }

        return new Promise((resolve, reject) => {
            const execOptions: Record<string, unknown> = {}
            if (options?.env) { execOptions.env = options.env }
            if (options?.pty) { execOptions.pty = true }

            conn.exec(command, execOptions, (err, stream) => {
                if (err) { return reject(err) }

                stream.on('close', (code: number) => {
                    resolve(code)
                }).on('data', (data: Buffer | string) => {
                    onStdout(data.toString())
                }).stderr.on('data', (data: Buffer | string) => {
                    onStderr(data.toString())
                })
            })
        })
    }

    async listDirectory(connectionId: string, path: string): Promise<{ success: boolean; files?: SSHFile[]; error?: string }> {
        const conn = this.connections.get(connectionId)
        if (!conn) { throw new Error('Not connected') }

        return new Promise((resolve) => {
            conn.sftp((err, sftp) => {
                if (err) { return resolve({ success: false, error: err.message }) }
                sftp.readdir(path, (err, list) => {
                    if (err) { return resolve({ success: false, error: err.message }) }
                    const files = list.map((entry) => {
                        const permissions = typeof entry.longname === 'string'
                            ? entry.longname.split(/\s+/)[0]
                            : undefined
                        const size = entry.attrs.size
                        const mtime = entry.attrs.mtime
                        const isDirectory = typeof entry.attrs.isDirectory === 'function'
                            ? entry.attrs.isDirectory()
                            : (typeof entry.longname === 'string' ? entry.longname.startsWith('d') : false)
                        return {
                            name: entry.filename,
                            isDirectory,
                            size,
                            mtime,
                            permissions
                        }
                    })
                    resolve({ success: true, files })
                })
            })
        })
    }

    async readFile(connectionId: string, path: string): Promise<string> {
        const conn = this.connections.get(connectionId)
        if (!conn) { throw new Error('Not connected') }

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) { return reject(err) }
                const stream = sftp.createReadStream(path)
                let data = ''
                stream.on('data', (d: Buffer | string) => data += d.toString())
                stream.on('end', () => resolve(data))
                stream.on('error', (err: Error) => reject(err))
            })
        })
    }

    async writeFile(connectionId: string, path: string, content: string): Promise<boolean> {
        const conn = this.connections.get(connectionId)
        if (!conn) { throw new Error('Not connected') }

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) { return reject(err) }
                const stream = sftp.createWriteStream(path)
                stream.write(content)
                stream.end()
                stream.on('close', () => resolve(true))
                stream.on('error', (err: Error) => reject(err))
            })
        })
    }

    async deleteDirectory(connectionId: string, path: string): Promise<boolean> {
        const conn = this.connections.get(connectionId)
        if (!conn) { throw new Error('Not connected') }

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) { return reject(err) }
                sftp.rmdir(path, (err) => {
                    if (err) { return reject(err) }
                    resolve(true)
                })
            })
        })
    }

    async deleteFile(connectionId: string, path: string): Promise<boolean> {
        const conn = this.connections.get(connectionId)
        if (!conn) { throw new Error('Not connected') }

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) { return reject(err) }
                sftp.unlink(path, (err) => {
                    if (err) { return reject(err) }
                    resolve(true)
                })
            })
        })
    }

    async createDirectory(connectionId: string, path: string): Promise<boolean> {
        const conn = this.connections.get(connectionId)
        if (!conn) { throw new Error('Not connected') }

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) { return reject(err) }
                sftp.mkdir(path, (err) => {
                    if (err) { return reject(err) }
                    resolve(true)
                })
            })
        })
    }

    async rename(connectionId: string, oldPath: string, newPath: string): Promise<boolean> {
        const conn = this.connections.get(connectionId)
        if (!conn) { throw new Error('Not connected') }

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) { return reject(err) }
                sftp.rename(oldPath, newPath, (err) => {
                    if (err) { return reject(err) }
                    resolve(true)
                })
            })
        })
    }

    async uploadFile(connectionId: string, localPath: string, remotePath: string, onProgress?: (transferred: number, total: number) => void): Promise<boolean> {
        const conn = this.connections.get(connectionId)
        if (!conn) { throw new Error('Not connected') }

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) { return reject(err) }

                // Use fastPut for efficiency
                sftp.fastPut(localPath, remotePath, {
                    step: (transferred, _chunk, total) => {
                        if (onProgress) { onProgress(transferred, total) }
                    }
                }, (err) => {
                    if (err) { return reject(err) }
                    resolve(true)
                })
            })
        })
    }

    async downloadFile(connectionId: string, remotePath: string, localPath: string, onProgress?: (transferred: number, total: number) => void): Promise<boolean> {
        const conn = this.connections.get(connectionId)
        if (!conn) { throw new Error('Not connected') }

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) { return reject(err) }

                sftp.fastGet(remotePath, localPath, {
                    step: (transferred, _chunk, total) => {
                        if (onProgress) { onProgress(transferred, total) }
                    }
                }, (err) => {
                    if (err) { return reject(err) }
                    resolve(true)
                })
            })
        })
    }

    async startShell(connectionId: string, onData: (data: string) => void, onExit: () => void): Promise<{ success: boolean; error?: string }> {
        const conn = this.connections.get(connectionId)
        if (!conn) { return { success: false, error: 'Not connected' } }

        // Check if shell already exists
        if (this.shellSessions.has(connectionId)) {
            return { success: true }
        }

        return new Promise((resolve) => {
            conn.shell({ term: 'xterm-256color' }, (err, stream) => {
                if (err) {
                    resolve({ success: false, error: err.message })
                    return
                }

                this.shellSessions.set(connectionId, { stream, onData, onExit })

                stream.on('data', (data: Buffer | string) => {
                    onData(data.toString())
                })

                stream.on('close', () => {
                    this.shellSessions.delete(connectionId)
                    onExit()
                })

                resolve({ success: true })
            })
        })
    }

    /**
     * Resize the shell terminal
     */
    resizeShell(connectionId: string, cols: number, rows: number): boolean {
        const session = this.shellSessions.get(connectionId)
        if (!session) { return false }

        session.stream.setWindow(rows, cols, 0, 0)
        return true
    }

    /**
     * Close the shell session
     */
    closeShell(connectionId: string): boolean {
        const session = this.shellSessions.get(connectionId)
        if (!session) { return false }

        session.stream.close()
        this.shellSessions.delete(connectionId)
        return true
    }

    async getLogFiles(connectionId: string): Promise<string[]> {
        const conn = this.connections.get(connectionId)
        if (!conn) { throw new Error('Not connected') }

        // List common log locations
        try {
            const cmd = `find /var/log -maxdepth 2 -name "*.log" -o -name "syslog" -o -name "messages" | head -n 20`
            const { stdout } = await this.executeCommand(connectionId, cmd)
            return stdout.split('\n').filter(l => l.trim())
        } catch (e) {
            appLogger.error('SSHService', `Failed to get log files: ${getErrorMessage(e as Error)}`)
            return []
        }
    }

    async readLogFile(connectionId: string, filePath: string, lines: number = 50): Promise<string> {
        const conn = this.connections.get(connectionId)
        if (!conn) { throw new Error('Not connected') }

        // Normalize path to resolve '..' segments
        // We use path.posix because SSH targets are typically Linux/Unix
        const normalizedPath = path.posix.normalize(filePath)

        // Ensure it starts with /var/log
        if (!normalizedPath.startsWith('/var/log/') && normalizedPath !== '/var/log') {
            throw new Error('Access denied: Path must be within /var/log')
        }

        // Safe quoting for shell command
        // Replace single quotes with '"'"' to breaks out of single quotes, insert a single quote, and resume
        const safePath = `'${normalizedPath.replace(/'/g, "'\"'\"'")}'`

        const { stdout } = await this.executeCommand(connectionId, `tail -n ${lines} ${safePath}`)
        return stdout
    }

    sendShellData(connectionId: string, data: string): boolean {
        const session = this.shellSessions.get(connectionId)
        if (!session) { return false }

        session.stream.write(data)

        // Update stats
        const stats = this.connectionStats.get(connectionId)
        if (stats) {
            stats.bytesSent += data.length
            stats.lastActivity = Date.now()
        }

        return true
    }

    /**
     * Create a local port forward (local -> remote)
     */
    async createLocalForward(
        connectionId: string,
        localHost: string,
        localPort: number,
        remoteHost: string,
        remotePort: number
    ): Promise<{ success: boolean; forwardId?: string; error?: string }> {
        const conn = this.connections.get(connectionId)
        if (!conn) { return { success: false, error: 'Not connected' } }

        const forwardId = crypto.randomUUID()

        return new Promise((resolve) => {
            const server = net.createServer((socket: net.Socket) => {
                conn.forwardOut(
                    socket.remoteAddress ?? '127.0.0.1',
                    socket.remotePort ?? 0,
                    remoteHost,
                    remotePort,
                    (err: Error | undefined, stream: NodeJS.ReadWriteStream) => {
                        if (err) {
                            socket.end()
                            return
                        }
                        socket.pipe(stream).pipe(socket)
                    }
                )
            })

            server.listen(localPort, localHost, () => {
                const forward: PortForward = {
                    id: forwardId,
                    connectionId,
                    type: 'local',
                    localHost,
                    localPort,
                    remoteHost,
                    remotePort,
                    active: true
                }
                this.portForwards.set(forwardId, forward)
                this.emit('portForwardCreated', forward)
                resolve({ success: true, forwardId })
            })

            server.on('error', (err: Error) => {
                resolve({ success: false, error: err.message })
            })
        })
    }

    /**
     * Get all active port forwards
     */
    getPortForwards(connectionId?: string): PortForward[] {
        const forwards = Array.from(this.portForwards.values())
        if (connectionId) {
            return forwards.filter(f => f.connectionId === connectionId)
        }
        return forwards
    }

    /**
     * Close a port forward
     */
    closePortForward(forwardId: string): boolean {
        const forward = this.portForwards.get(forwardId)
        if (!forward) { return false }

        forward.active = false
        this.portForwards.delete(forwardId)
        this.emit('portForwardClosed', forwardId)
        return true
    }

    /**
     * Disconnect all connections and cleanup
     */
    async disconnectAll(): Promise<void> {
        for (const [id, conn] of this.connections) {
            try {
                conn.end()
            } catch (e) {
                appLogger.error('SSHService', `Error disconnecting ${id}: ${getErrorMessage(e as Error)}`)
            }
        }

        // Clear all timers
        for (const timer of this.keepaliveTimers.values()) {
            clearInterval(timer)
        }

        this.connections.clear()
        this.connectionDetails.clear()
        this.connectionStats.clear()
        this.shellSessions.clear()
        this.portForwards.clear()
        this.keepaliveTimers.clear()
    }

    async getSystemStats(connectionId: string): Promise<SSHSystemStats> {
        try {
            const uptime = (await this.executeCommand(connectionId, 'uptime -p')).stdout.trim()
            const memoryOutput = (await this.executeCommand(connectionId, 'free -m')).stdout
            const cpuOutput = (await this.executeCommand(connectionId, 'top -bn1 | grep "Cpu(s)"')).stdout
            const diskOutput = (await this.executeCommand(connectionId, 'df -h /')).stdout

            return {
                uptime,
                memory: this.parseMemoryStats(memoryOutput),
                cpu: this.parseCpuStats(cpuOutput),
                disk: this.parseDiskStats(diskOutput)
            }
        } catch (error) {
            const message = getErrorMessage(error as Error)
            appLogger.error('SSHService', `Failed to get system stats: ${message}`)
            return { error: message, uptime: '-', memory: { total: 0, used: 0, percent: 0 }, cpu: 0, disk: '0%' }
        }
    }

    private parseMemoryStats(output: string) {
        const lines = output.split('\n')
        const values = lines[1]?.split(/\s+/).filter(Boolean) || []
        const total = parseInt(values[1] || '0')
        const used = parseInt(values[2] || '0')
        return { total, used, percent: total ? Math.round((used / total) * 100) : 0 }
    }

    private parseCpuStats(output: string): number {
        return parseFloat(output.split(',')[0].replace('Cpu(s):', '').trim()) || 0
    }

    private parseDiskStats(output: string): string {
        const lines = output.split('\n')
        const values = lines[1]?.split(/\s+/).filter(Boolean) || []
        return values[4] || '0%'
    }

    async getInstalledPackages(connectionId: string, manager: 'apt' | 'npm' | 'pip' = 'apt'): Promise<SSHPackageInfo[]> {
        try {
            let command = ''
            switch (manager) {
                case 'apt': command = 'apt list --installed'; break
                case 'npm': command = 'npm list -g --depth=0'; break
                case 'pip': command = 'pip list'; break
                default: return []
            }

            const result = await this.executeCommand(connectionId, command)
            const lines = result.stdout.split('\n')

            if (manager === 'apt') {
                return lines.slice(1).map(l => {
                    const parts = l.split('/')
                    return parts[0] ? { name: parts[0], version: 'latest' } : null
                }).filter((p): p is SSHPackageInfo => p !== null)
            }
            if (manager === 'npm') {
                return lines.slice(1).map(l => {
                    const parts = l.split('@')
                    return parts[0] ? { name: parts[0].trim().replace(/^.* /, ''), version: parts[1]?.trim() || 'unknown' } : null
                }).filter((p): p is SSHPackageInfo => p !== null)
            }
            if (manager === 'pip') {
                return lines.slice(2).map(l => {
                    const parts = l.split(/\s+/)
                    return parts[0] ? { name: parts[0], version: parts[1] || 'unknown' } : null
                }).filter((p): p is SSHPackageInfo => p !== null)
            }

            return []
        } catch (error) {
            appLogger.error('SSHService', `Failed to get packages: ${getErrorMessage(error as Error)}`)
            return []
        }
    }
}
