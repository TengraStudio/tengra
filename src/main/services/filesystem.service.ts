import * as fs from 'fs/promises'
import * as path from 'path'

export class FileSystemService {
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

            // Create directory if it doesn't exist
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
                    } catch {
                        // Ignore stat errors
                    }

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
            const absolutePath = path.resolve(filePath)
            await fs.unlink(absolutePath)
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    async deleteDirectory(dirPath: string): Promise<{ success: boolean; error?: string }> {
        try {
            const absolutePath = path.resolve(dirPath)
            await fs.rm(absolutePath, { recursive: true, force: true })
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    async fileExists(filePath: string): Promise<{ exists: boolean }> {
        try {
            const absolutePath = path.resolve(filePath)
            await fs.access(absolutePath)
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
            const destDir = path.dirname(destPath)

            await fs.mkdir(destDir, { recursive: true })
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
            const destDir = path.dirname(destPath)

            await fs.mkdir(destDir, { recursive: true })
            await fs.rename(srcPath, destPath)

            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    async searchFiles(rootPath: string, pattern: string): Promise<{ success: boolean; matches?: string[]; error?: string }> {
        try {
            const absoluteRoot = path.resolve(rootPath)
            const matches: string[] = []

            async function walk(dir: string) {
                const entries = await fs.readdir(dir, { withFileTypes: true })
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name)
                    if (entry.isDirectory()) {
                        await walk(fullPath)
                    } else if (entry.name.includes(pattern)) {
                        matches.push(fullPath)
                    }
                }
            }

            await walk(absoluteRoot)
            return { success: true, matches }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    async getFileHash(filePath: string, algorithm: 'md5' | 'sha1' | 'sha256' = 'sha256'): Promise<{ success: boolean; hash?: string; error?: string }> {
        try {
            const { createHash } = await import('crypto')
            const absolutePath = path.resolve(filePath)
            const content = await fs.readFile(absolutePath)
            const hash = createHash(algorithm).update(content).digest('hex')
            return { success: true, hash }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }
}

