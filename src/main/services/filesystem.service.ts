import * as fs from 'fs/promises'
import { watch } from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as https from 'https'
import { createWriteStream } from 'fs'
import { ServiceResponse } from './../../shared/types/index'

const execAsync = promisify(exec)

export class FileSystemService {
    constructor(_allowedRoots?: string[]) {
        // Restrictions removed by user request
    }

    updateAllowedRoots(_allowedRoots: string[]) {
        // No-op
    }



    // --- Core Operations ---

    async readFile(filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
        try {
            const absolutePath = path.resolve(filePath)
            const content = await fs.readFile(absolutePath, 'utf-8')
            return { success: true, content }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    async writeFile(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
        try {
            const absolutePath = path.resolve(filePath)
            const dir = path.dirname(absolutePath)
            await fs.mkdir(dir, { recursive: true })
            await fs.writeFile(absolutePath, content, 'utf-8')
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    async listDirectory(dirPath: string): Promise<{ success: boolean; files?: any[]; error?: string }> {
        try {
            const absolutePath = path.resolve(dirPath)
            const entries = await fs.readdir(absolutePath, { withFileTypes: true })
            const files = await Promise.all(
                entries.map(async (entry) => {
                    const entryPath = path.join(absolutePath, entry.name)
                    let size: number | undefined
                    let modified: Date | undefined
                    try {
                        const stats = await fs.stat(entryPath)
                        size = stats.size
                        modified = stats.mtime
                    } catch { }
                    return {
                        name: entry.name,
                        isDirectory: entry.isDirectory(),
                        size,
                        modified
                    }
                })
            )
            return { success: true, files }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    async createDirectory(dirPath: string): Promise<{ success: boolean; error?: string }> {
        try {
            const absolutePath = path.resolve(dirPath)
            await fs.mkdir(absolutePath, { recursive: true })
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    async deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
        try {
            await fs.unlink(path.resolve(filePath))
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    async deleteDirectory(dirPath: string): Promise<{ success: boolean; error?: string }> {
        try {
            await fs.rm(path.resolve(dirPath), { recursive: true, force: true })
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    async fileExists(filePath: string): Promise<{ exists: boolean }> {
        try {
            await fs.access(path.resolve(filePath))
            return { exists: true }
        } catch {
            return { exists: false }
        }
    }

    async getFileInfo(filePath: string): Promise<{ success: boolean; info?: any; error?: string }> {
        try {
            const absolutePath = path.resolve(filePath)
            const stats = await fs.stat(absolutePath)
            return {
                success: true,
                info: {
                    path: absolutePath,
                    size: stats.size,
                    isDirectory: stats.isDirectory(),
                    isFile: stats.isFile(),
                    created: stats.birthtime,
                    modified: stats.mtime,
                    accessed: stats.atime
                }
            }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    async copyFile(source: string, destination: string): Promise<{ success: boolean; error?: string }> {
        try {
            const srcPath = path.resolve(source)
            const destPath = path.resolve(destination)
            await fs.mkdir(path.dirname(destPath), { recursive: true })
            await fs.copyFile(srcPath, destPath)
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    async moveFile(source: string, destination: string): Promise<{ success: boolean; error?: string }> {
        try {
            const srcPath = path.resolve(source)
            const destPath = path.resolve(destination)
            await fs.mkdir(path.dirname(destPath), { recursive: true })
            await fs.rename(srcPath, destPath)
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    // --- Extended Operations (from FileManagementService) ---

    async extractStrings(filePath: string, minLength: number = 4): Promise<ServiceResponse<{ strings: string[] }>> {
        try {
            const buffer = await fs.readFile(path.resolve(filePath))
            const strings: string[] = []
            let current = ""
            for (let i = 0; i < buffer.length; i++) {
                const char = buffer[i]
                if (char >= 32 && char <= 126) {
                    current += String.fromCharCode(char)
                } else {
                    if (current.length >= minLength) strings.push(current)
                    current = ""
                }
            }
            return { success: true, result: { strings } }
        } catch (e: any) {
            return { success: false, error: e.message }
        }
    }

    async syncNote(title: string, content: string, dir: string): Promise<ServiceResponse<{ path: string }>> {
        try {
            const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`
            const fullPath = path.join(dir, fileName)
            await fs.writeFile(fullPath, content)
            return { success: true, result: { path: fullPath } }
        } catch (e: any) {
            return { success: false, error: e.message }
        }
    }

    async unzip(zipPath: string, destPath: string): Promise<ServiceResponse> {
        try {
            if (process.platform === 'win32') {
                await execAsync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destPath}' -Force"`)
            } else {
                await execAsync(`unzip -o "${zipPath}" -d "${destPath}"`)
            }
            return { success: true, message: `Extracted to ${destPath}` }
        } catch (e: any) {
            return { success: false, error: e.message }
        }
    }

    async batchRename(dir: string, pattern: string, replacement: string): Promise<ServiceResponse> {
        try {
            const files = await fs.readdir(dir)
            let count = 0
            for (const file of files) {
                if (file.includes(pattern)) {
                    const newName = file.replace(pattern, replacement)
                    await fs.rename(path.join(dir, file), path.join(dir, newName))
                    count++
                }
            }
            return { success: true, message: `${count} files renamed.` }
        } catch (e: any) {
            return { success: false, error: e.message }
        }
    }

    watchFolder(dir: string): ServiceResponse {
        try {
            watch(dir, (eventType, filename) => {
                console.log(`Folder changed: ${eventType} on ${filename}`)
            })
            return { success: true, message: `Watching ${dir} for changes...` }
        } catch (e: any) {
            return { success: false, error: e.message }
        }
    }

    async downloadFile(url: string, destPath: string): Promise<ServiceResponse<{ path: string }>> {
        return new Promise((resolve) => {
            const file = createWriteStream(destPath)
            https.get(url, (response: any) => {
                response.pipe(file)
                file.on('finish', () => {
                    file.close()
                    resolve({ success: true, result: { path: destPath } })
                })
            }).on('error', (err: any) => {
                fs.unlink(destPath).catch(() => { })
                resolve({ success: false, error: err.message })
            })
        })
    }

    async getFileHash(filePath: string, algorithm: 'md5' | 'sha1' | 'sha256' = 'sha256'): Promise<{ success: boolean; hash?: string; error?: string }> {
        try {
            const { createHash } = await import('crypto')
            const content = await fs.readFile(path.resolve(filePath))
            const hash = createHash(algorithm).update(content).digest('hex')
            return { success: true, hash }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    async searchFiles(rootPath: string, pattern: string): Promise<{ success: boolean; files?: string[]; error?: string }> {
        try {
            const results: string[] = []
            const walk = async (dir: string) => {
                const entries = await fs.readdir(dir, { withFileTypes: true })
                for (const entry of entries) {
                    const full = path.join(dir, entry.name)
                    if (entry.isDirectory()) {
                        if (entry.name !== 'node_modules' && entry.name !== '.git') await walk(full)
                    } else if (entry.name.includes(pattern)) {
                        results.push(full)
                    }
                }
            }
            await walk(path.resolve(rootPath))
            return { success: true, files: results }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }
}
