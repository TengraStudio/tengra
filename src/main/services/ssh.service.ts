// SSHService - Remote server connection and command execution

import { Client, ConnectConfig } from 'ssh2'
import { createReadStream, createWriteStream } from 'fs'
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

export interface SSHCommandResult {
    success: boolean
    stdout?: string
    stderr?: string
    code?: number
    error?: string
}

export class SSHService extends EventEmitter {
    private connections: Map<string, { config: SSHConnection; client: Client }> = new Map()
    private activeShells: Map<string, any> = new Map() // connectionId -> stream

    constructor() {
        super()
    }

    async connect(connection: SSHConnection): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            if (this.connections.has(connection.id)) {
                resolve({ success: true })
                return
            }

            const client = new Client()

            const config: ConnectConfig = {
                host: connection.host,
                port: connection.port || 22,
                username: connection.username,
                readyTimeout: 30000,
                keepaliveInterval: 10000,
            }

            if (connection.authType === 'password') {
                config.password = connection.password
            } else if (connection.authType === 'key') {
                config.privateKey = connection.privateKey
                if (connection.passphrase) {
                    config.passphrase = connection.passphrase
                }
            }

            client.on('ready', () => {
                console.log(`SSH connected to ${connection.host}`)
                connection.connected = true
                this.connections.set(connection.id, { config: connection, client })
                this.emit('connected', connection.id)
                resolve({ success: true })
            })

            client.on('error', (err) => {
                console.error(`SSH error for ${connection.host}:`, err.message)
                this.emit('error', { connectionId: connection.id, error: err.message })
                resolve({ success: false, error: err.message })
            })

            client.on('close', () => {
                console.log(`SSH disconnected from ${connection.host}`)
                connection.connected = false
                this.connections.delete(connection.id)
                this.emit('disconnected', connection.id)
            })

            client.connect(config)
        })
    }

    async disconnect(connectionId: string): Promise<void> {
        const conn = this.connections.get(connectionId)
        if (conn) {
            conn.client.end()
            this.connections.delete(connectionId)
        }
    }

    async disconnectAll(): Promise<void> {
        for (const [id] of this.connections) {
            await this.disconnect(id)
        }
    }

    async executeCommand(
        connectionId: string,
        command: string,
        options?: { cwd?: string; timeout?: number }
    ): Promise<SSHCommandResult> {
        return new Promise((resolve) => {
            const conn = this.connections.get(connectionId)

            if (!conn) {
                resolve({ success: false, error: 'Not connected' })
                return
            }

            let fullCommand = command
            if (options?.cwd) {
                fullCommand = `cd ${options.cwd} && ${command}`
            }

            conn.client.exec(fullCommand, { pty: false }, (err, stream) => {
                if (err) {
                    resolve({ success: false, error: err.message })
                    return
                }

                let stdout = ''
                let stderr = ''

                // Set timeout
                const timeout = options?.timeout || 0 // No default timeout
                let timer: NodeJS.Timeout | undefined

                if (timeout > 0) {
                    timer = setTimeout(() => {
                        stream.close()
                        resolve({ success: false, error: 'Command timeout' })
                    }, timeout)
                }

                stream.on('data', (data: Buffer) => {
                    stdout += data.toString()
                    this.emit('stdout', { connectionId, data: data.toString() })
                })

                stream.stderr.on('data', (data: Buffer) => {
                    stderr += data.toString()
                    this.emit('stderr', { connectionId, data: data.toString() })
                })

                stream.on('close', (code: number) => {
                    clearTimeout(timer)
                    resolve({
                        success: code === 0,
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        code
                    })
                })
            })
        })
    }

    async startShell(
        connectionId: string,
        onData: (data: string) => void,
        onClose: () => void
    ): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const conn = this.connections.get(connectionId)

            if (!conn) {
                resolve({ success: false, error: 'Not connected' })
                return
            }

            if (this.activeShells.has(connectionId)) {
                resolve({ success: true }) // Already has a shell
                return
            }

            conn.client.shell((err, stream) => {
                if (err) {
                    resolve({ success: false, error: err.message })
                    return
                }

                this.activeShells.set(connectionId, stream)

                stream.on('data', (data: Buffer) => {
                    onData(data.toString())
                })

                stream.on('close', () => {
                    this.activeShells.delete(connectionId)
                    onClose()
                })

                resolve({ success: true })
            })
        })
    }

    sendShellData(connectionId: string, data: string): boolean {
        const stream = this.activeShells.get(connectionId)
        if (stream) {
            stream.write(data)
            return true
        }
        return false
    }

    closeShell(connectionId: string): void {
        const stream = this.activeShells.get(connectionId)
        if (stream) {
            stream.end()
            this.activeShells.delete(connectionId)
        }
    }

    async uploadFile(
        connectionId: string,
        localPath: string,
        remotePath: string,
        onProgress?: (transferred: number, total: number) => void
    ): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const conn = this.connections.get(connectionId)

            if (!conn) {
                resolve({ success: false, error: 'Not connected' })
                return
            }

            conn.client.sftp((err, sftp) => {
                if (err) {
                    resolve({ success: false, error: err.message })
                    return
                }

                const readStream = createReadStream(localPath)
                const writeStream = sftp.createWriteStream(remotePath)

                const fs = require('fs')
                const stats = fs.statSync(localPath)
                const totalSize = stats.size
                let transferred = 0

                readStream.on('data', (chunk) => {
                    transferred += chunk.length
                    onProgress?.(transferred, totalSize)
                })

                writeStream.on('close', () => {
                    resolve({ success: true })
                })

                writeStream.on('error', (err: Error) => {
                    resolve({ success: false, error: err.message })
                })

                readStream.pipe(writeStream)
            })
        })
    }

    async downloadFile(
        connectionId: string,
        remotePath: string,
        localPath: string,
        onProgress?: (transferred: number, total: number) => void
    ): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const conn = this.connections.get(connectionId)

            if (!conn) {
                resolve({ success: false, error: 'Not connected' })
                return
            }

            conn.client.sftp((err, sftp) => {
                if (err) {
                    resolve({ success: false, error: err.message })
                    return
                }

                sftp.stat(remotePath, (statErr, stats) => {
                    if (statErr) {
                        resolve({ success: false, error: statErr.message })
                        return
                    }

                    const totalSize = stats.size
                    let transferred = 0

                    const readStream = sftp.createReadStream(remotePath)
                    const writeStream = createWriteStream(localPath)

                    readStream.on('data', (chunk: Buffer) => {
                        transferred += chunk.length
                        onProgress?.(transferred, totalSize)
                    })

                    writeStream.on('close', () => {
                        resolve({ success: true })
                    })

                    writeStream.on('error', (err: Error) => {
                        resolve({ success: false, error: err.message })
                    })

                    readStream.pipe(writeStream)
                })
            })
        })
    }

    async listDirectory(connectionId: string, remotePath: string): Promise<{ success: boolean; files?: any[]; error?: string }> {
        return new Promise((resolve) => {
            const conn = this.connections.get(connectionId)

            if (!conn) {
                resolve({ success: false, error: 'Not connected' })
                return
            }

            conn.client.sftp((err, sftp) => {
                if (err) {
                    resolve({ success: false, error: err.message })
                    return
                }

                sftp.readdir(remotePath, (readdirErr, list) => {
                    if (readdirErr) {
                        resolve({ success: false, error: readdirErr.message })
                        return
                    }

                    const files = list.map(item => ({
                        name: item.filename,
                        type: item.attrs.isDirectory() ? 'directory' : 'file',
                        size: item.attrs.size,
                        modified: new Date(item.attrs.mtime * 1000).toISOString()
                    }))

                    resolve({ success: true, files })
                })
            })
        })
    }

    async readFile(connectionId: string, remotePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
        return new Promise((resolve) => {
            const conn = this.connections.get(connectionId)
            if (!conn) {
                resolve({ success: false, error: 'Not connected' })
                return
            }

            conn.client.sftp((err, sftp) => {
                if (err) {
                    resolve({ success: false, error: err.message })
                    return
                }

                const chunks: Buffer[] = []
                const stream = sftp.createReadStream(remotePath)
                stream.on('data', (chunk: Buffer) => chunks.push(chunk))
                stream.on('error', (streamErr: Error) => {
                    resolve({ success: false, error: streamErr.message })
                })
                stream.on('close', () => {
                    const content = Buffer.concat(chunks).toString('utf-8')
                    resolve({ success: true, content })
                })
            })
        })
    }

    async writeFile(connectionId: string, remotePath: string, content: string): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const conn = this.connections.get(connectionId)
            if (!conn) {
                resolve({ success: false, error: 'Not connected' })
                return
            }

            conn.client.sftp((err, sftp) => {
                if (err) {
                    resolve({ success: false, error: err.message })
                    return
                }

                const stream = sftp.createWriteStream(remotePath)
                stream.on('error', (streamErr: Error) => {
                    resolve({ success: false, error: streamErr.message })
                })
                stream.on('close', () => {
                    resolve({ success: true })
                })
                stream.end(content, 'utf-8')
            })
        })
    }

    async deleteFile(connectionId: string, remotePath: string): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const conn = this.connections.get(connectionId)
            if (!conn) { resolve({ success: false, error: 'Not connected' }); return }

            conn.client.sftp((err, sftp) => {
                if (err) { resolve({ success: false, error: err.message }); return }
                sftp.unlink(remotePath, (err) => {
                    if (err) resolve({ success: false, error: err.message })
                    else resolve({ success: true })
                })
            })
        })
    }

    async deleteDirectory(connectionId: string, remotePath: string): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const conn = this.connections.get(connectionId)
            if (!conn) { resolve({ success: false, error: 'Not connected' }); return }

            conn.client.sftp((err, sftp) => {
                if (err) { resolve({ success: false, error: err.message }); return }
                sftp.rmdir(remotePath, (err) => {
                    if (err) resolve({ success: false, error: err.message })
                    else resolve({ success: true })
                })
            })
        })
    }

    async rename(connectionId: string, oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const conn = this.connections.get(connectionId)
            if (!conn) { resolve({ success: false, error: 'Not connected' }); return }

            conn.client.sftp((err, sftp) => {
                if (err) { resolve({ success: false, error: err.message }); return }
                sftp.rename(oldPath, newPath, (err) => {
                    if (err) resolve({ success: false, error: err.message })
                    else resolve({ success: true })
                })
            })
        })
    }

    async createDirectory(connectionId: string, remotePath: string): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const conn = this.connections.get(connectionId)
            if (!conn) { resolve({ success: false, error: 'Not connected' }); return }

            conn.client.sftp((err, sftp) => {
                if (err) { resolve({ success: false, error: err.message }); return }
                sftp.mkdir(remotePath, (err) => {
                    if (err) resolve({ success: false, error: err.message })
                    else resolve({ success: true })
                })
            })
        })
    }

    getConnection(connectionId: string): SSHConnection | null {
        const conn = this.connections.get(connectionId)
        return conn?.config || null
    }

    getAllConnections(): SSHConnection[] {
        return Array.from(this.connections.values()).map(c => c.config)
    }

    isConnected(connectionId: string): boolean {
        return this.connections.has(connectionId)
    }
}
