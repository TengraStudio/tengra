import { Client } from 'ssh2'
import { EventEmitter } from 'events'

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
}

export class SSHService extends EventEmitter {
    private connections: Map<string, Client> = new Map()
    private connectionDetails: Map<string, SSHConnection> = new Map()

    constructor() {
        super()
    }

    async connect(config: SSHConnection): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const conn = new Client()

            conn.on('ready', () => {
                this.connections.set(config.id, conn)
                this.connectionDetails.set(config.id, { ...config, connected: true })
                this.emit('connected', config.id)
                resolve({ success: true })
            }).on('error', (err) => {
                this.emit('error', { id: config.id, message: err.message })
                resolve({ success: false, error: err.message })
            }).on('close', () => {
                this.connections.delete(config.id)
                this.connectionDetails.delete(config.id)
                this.emit('disconnected', config.id)
            })

            try {
                conn.connect({
                    host: config.host,
                    port: config.port,
                    username: config.username,
                    password: config.password,
                    privateKey: config.privateKey ? require('fs').readFileSync(config.privateKey) : undefined,
                    passphrase: config.passphrase
                })
            } catch (error: any) {
                resolve({ success: false, error: error.message })
            }
        })
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

    async executeCommand(connectionId: string, command: string, _options?: any): Promise<{ stdout: string; stderr: string; code: number }> {
        const conn = this.connections.get(connectionId)
        if (!conn) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            conn.exec(command, (err, stream) => {
                if (err) return reject(err)
                let stdout = ''
                let stderr = ''
                stream.on('close', (code: number, _signal: any) => {
                    resolve({ stdout, stderr, code })
                }).on('data', (data: any) => {
                    stdout += data
                }).stderr.on('data', (data: any) => {
                    stderr += data
                })
            })
        })
    }

    async listDirectory(connectionId: string, path: string): Promise<any[]> {
        const conn = this.connections.get(connectionId)
        if (!conn) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) return reject(err)
                sftp.readdir(path, (err, list) => {
                    if (err) return reject(err)
                    resolve(list)
                })
            })
        })
    }

    async readFile(_connectionId: string, _path: string): Promise<string> {
        throw new Error('Not implemented')
    }

    async writeFile(_connectionId: string, _path: string, _content: string): Promise<boolean> {
        throw new Error('Not implemented')
    }

    async deleteDirectory(_connectionId: string, _path: string): Promise<boolean> {
        throw new Error('Not implemented')
    }

    async deleteFile(_connectionId: string, _path: string): Promise<boolean> {
        throw new Error('Not implemented')
    }

    async createDirectory(_connectionId: string, _path: string): Promise<boolean> {
        throw new Error('Not implemented')
    }

    async rename(_connectionId: string, _oldPath: string, _newPath: string): Promise<boolean> {
        throw new Error('Not implemented')
    }

    async uploadFile(_connectionId: string, _localPath: string, _remotePath: string, _onProgress?: (transferred: number, total: number) => void): Promise<boolean> {
        throw new Error('Not implemented')
    }

    async downloadFile(_connectionId: string, _remotePath: string, _localPath: string, _onProgress?: (transferred: number, total: number) => void): Promise<boolean> {
        throw new Error('Not implemented')
    }

    async startShell(_connectionId: string, _onData: (data: string) => void, _onExit: () => void): Promise<{ success: boolean }> {
        // Simple mock shell
        return { success: true }
    }

    sendShellData(_connectionId: string, _data: string): boolean {
        return true
    }
}
