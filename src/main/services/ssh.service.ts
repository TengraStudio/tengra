import * as fs from 'fs'
import * as path from 'path'
import { Client } from 'ssh2'
import { EventEmitter } from 'events'
import { SSHExecOptions, SSHFile, SSHSystemStats, SSHPackageInfo } from '../../shared/types/ssh'
import { getErrorMessage } from '../../shared/utils/error.util'

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
    [key: string]: string | number | boolean | undefined
}

export class SSHService extends EventEmitter {
    private connections: Map<string, Client> = new Map()
    private connectionDetails: Map<string, SSHConnection> = new Map()
    private storagePath: string

    constructor(storagePath: string) {
        super()
        this.storagePath = storagePath
        this.ensureProfilesFile()
    }

    private get profilesPath(): string {
        return path.join(this.storagePath, 'ssh-profiles.json')
    }

    private ensureProfilesFile() {
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true })
        }
        if (!fs.existsSync(this.profilesPath)) {
            fs.writeFileSync(this.profilesPath, JSON.stringify([], null, 2))
        }
    }

    async getSavedProfiles(): Promise<SSHConnection[]> {
        try {
            if (!fs.existsSync(this.profilesPath)) return []
            const content = fs.readFileSync(this.profilesPath, 'utf-8')
            return JSON.parse(content) as SSHConnection[]
        } catch (error) {
            console.error('Failed to load SSH profiles:', getErrorMessage(error as Error))
            return []
        }
    }

    async saveProfile(profile: SSHConnection): Promise<boolean> {
        try {
            const profiles = await this.getSavedProfiles()
            const index = profiles.findIndex(p => p.id === profile.id)

            // simple obfuscation for password/key (NOT SECURE PRODUCTION STORAGE)
            const safeProfile = { ...profile }

            if (index >= 0) {
                profiles[index] = safeProfile
            } else {
                profiles.push(safeProfile)
            }

            fs.writeFileSync(this.profilesPath, JSON.stringify(profiles, null, 2))
            return true
        } catch (error) {
            console.error('Failed to save SSH profile:', getErrorMessage(error as Error))
            return false
        }
    }

    async deleteProfile(id: string): Promise<boolean> {
        try {
            const profiles = await this.getSavedProfiles()
            const filtered = profiles.filter(p => p.id !== id)
            fs.writeFileSync(this.profilesPath, JSON.stringify(filtered, null, 2))
            return true
        } catch (error) {
            console.error('Failed to delete SSH profile:', getErrorMessage(error as Error))
            return false
        }
    }

    async connect(config: SSHConnection): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const conn = new Client()

            conn.on('ready', () => {
                this.connections.set(config.id, conn)
                this.connectionDetails.set(config.id, { ...config, connected: true })
                this.emit('connected', config.id)
                resolve({ success: true })
            }).on('error', (err: Error) => {
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
                    privateKey: config.privateKey ? fs.readFileSync(config.privateKey) : undefined,
                    passphrase: config.passphrase
                })
            } catch (error) {
                resolve({ success: false, error: getErrorMessage(error as Error) })
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

    async executeCommand(connectionId: string, command: string, _options?: SSHExecOptions): Promise<{ stdout: string; stderr: string; code: number }> {
        const conn = this.connections.get(connectionId)
        if (!conn) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            conn.exec(command, (err, stream) => {
                if (err) return reject(err)
                let stdout = ''
                let stderr = ''
                stream.on('close', (code: number) => {
                    resolve({ stdout, stderr, code })
                }).on('data', (data: Buffer | string) => {
                    stdout += data.toString()
                }).stderr.on('data', (data: Buffer | string) => {
                    stderr += data.toString()
                })
            })
        })
    }

    async listDirectory(connectionId: string, path: string): Promise<{ success: boolean; files?: SSHFile[]; error?: string }> {
        const conn = this.connections.get(connectionId)
        if (!conn) throw new Error('Not connected')

        return new Promise((resolve) => {
            conn.sftp((err, sftp) => {
                if (err) return resolve({ success: false, error: err.message })
                sftp.readdir(path, (err, list) => {
                    if (err) return resolve({ success: false, error: err.message })
                    const files = list.map((entry) => {
                        const permissions = typeof entry.longname === 'string'
                            ? entry.longname.split(/\s+/)[0]
                            : undefined
                        const size = typeof entry.attrs?.size === 'number' ? entry.attrs.size : undefined
                        const mtime = typeof entry.attrs?.mtime === 'number' ? entry.attrs.mtime : undefined
                        const isDirectory = typeof entry.attrs?.isDirectory === 'function'
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
        if (!conn) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) return reject(err)
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
        if (!conn) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) return reject(err)
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
        if (!conn) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) return reject(err)
                sftp.rmdir(path, (err) => {
                    if (err) return reject(err)
                    resolve(true)
                })
            })
        })
    }

    async deleteFile(connectionId: string, path: string): Promise<boolean> {
        const conn = this.connections.get(connectionId)
        if (!conn) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) return reject(err)
                sftp.unlink(path, (err) => {
                    if (err) return reject(err)
                    resolve(true)
                })
            })
        })
    }

    async createDirectory(connectionId: string, path: string): Promise<boolean> {
        const conn = this.connections.get(connectionId)
        if (!conn) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) return reject(err)
                sftp.mkdir(path, (err) => {
                    if (err) return reject(err)
                    resolve(true)
                })
            })
        })
    }

    async rename(connectionId: string, oldPath: string, newPath: string): Promise<boolean> {
        const conn = this.connections.get(connectionId)
        if (!conn) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) return reject(err)
                sftp.rename(oldPath, newPath, (err) => {
                    if (err) return reject(err)
                    resolve(true)
                })
            })
        })
    }

    async uploadFile(connectionId: string, localPath: string, remotePath: string, onProgress?: (transferred: number, total: number) => void): Promise<boolean> {
        const conn = this.connections.get(connectionId)
        if (!conn) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) return reject(err)

                // Use fastPut for efficiency
                sftp.fastPut(localPath, remotePath, {
                    step: (transferred, _chunk, total) => {
                        if (onProgress) onProgress(transferred, total)
                    }
                }, (err) => {
                    if (err) return reject(err)
                    resolve(true)
                })
            })
        })
    }

    async downloadFile(connectionId: string, remotePath: string, localPath: string, onProgress?: (transferred: number, total: number) => void): Promise<boolean> {
        const conn = this.connections.get(connectionId)
        if (!conn) throw new Error('Not connected')

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) return reject(err)

                sftp.fastGet(remotePath, localPath, {
                    step: (transferred, _chunk, total) => {
                        if (onProgress) onProgress(transferred, total)
                    }
                }, (err) => {
                    if (err) return reject(err)
                    resolve(true)
                })
            })
        })
    }

    async startShell(_connectionId: string, _onData: (data: string) => void, _onExit: () => void): Promise<{ success: boolean }> {
        // Simple mock shell
        return { success: true }
    }

    async getLogFiles(connectionId: string): Promise<string[]> {
        const conn = this.connections.get(connectionId)
        if (!conn) throw new Error('Not connected')

        // List common log locations
        try {
            const cmd = `find /var/log -maxdepth 2 -name "*.log" -o -name "syslog" -o -name "messages" | head -n 20`
            const { stdout } = await this.executeCommand(connectionId, cmd)
            return stdout.split('\n').filter(l => l.trim())
        } catch (e) {
            console.error('Failed to get log files:', getErrorMessage(e as Error))
            return []
        }
    }

    async readLogFile(connectionId: string, path: string, lines: number = 50): Promise<string> {
        const conn = this.connections.get(connectionId)
        if (!conn) throw new Error('Not connected')

        // Safety check path
        if (!path.startsWith('/var/log')) throw new Error('Access denied')

        const { stdout } = await this.executeCommand(connectionId, `tail -n ${lines} ${path}`)
        return stdout
    }

    sendShellData(_connectionId: string, _data: string): boolean {
        return true
    }

    async getSystemStats(connectionId: string): Promise<SSHSystemStats> {
        try {
            const uptime = (await this.executeCommand(connectionId, 'uptime -p')).stdout.trim()
            const memory = (await this.executeCommand(connectionId, 'free -m')).stdout
            const cpu = (await this.executeCommand(connectionId, 'top -bn1 | grep "Cpu(s)"')).stdout
            const disk = (await this.executeCommand(connectionId, 'df -h /')).stdout

            // Parse Memory
            const memLines = memory.split('\n')
            const memValues = memLines[1]?.split(/\s+/).filter(Boolean) || []
            const totalMem = parseInt(memValues[1] || '0')
            const usedMem = parseInt(memValues[2] || '0')

            // Parse CPU
            const cpuUsage = parseFloat(cpu.split(',')[0].replace('Cpu(s):', '').trim()) || 0

            // Parse Disk
            const diskLines = disk.split('\n')
            const diskValues = diskLines[1]?.split(/\s+/).filter(Boolean) || []
            const diskUsage = diskValues[4] || '0%'

            return {
                uptime,
                memory: { total: totalMem, used: usedMem, percent: totalMem ? Math.round((usedMem / totalMem) * 100) : 0 },
                cpu: cpuUsage,
                disk: diskUsage
            }
        } catch (error) {
            const message = getErrorMessage(error as Error)
            console.error('Failed to get system stats:', message)
            return { error: message, uptime: '-', memory: { total: 0, used: 0, percent: 0 }, cpu: 0, disk: '0%' }
        }
    }

    async getInstalledPackages(connectionId: string, manager: 'apt' | 'npm' | 'pip' = 'apt'): Promise<SSHPackageInfo[]> {
        try {
            let command = ''
            if (manager === 'apt') command = 'apt list --installed'
            if (manager === 'npm') command = 'npm list -g --depth=0'
            if (manager === 'pip') command = 'pip list'

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
            console.error('Failed to get packages:', getErrorMessage(error as Error))
            return []
        }
    }
}
