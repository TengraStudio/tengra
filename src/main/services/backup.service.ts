/**
 * Settings Backup Service
 * Backup and restore application settings and data
 */

import * as fs from 'fs'
import * as path from 'path'
import { DataService } from './data/data.service'
import { JsonObject, JsonValue } from '../../shared/types/common'
import { getErrorMessage } from '../../shared/utils/error.util'

export interface BackupMetadata {
    version: string
    createdAt: string
    appVersion: string
    platform: string
    includes: string[]
}

export interface BackupResult {
    success: boolean
    path?: string
    error?: string
    metadata?: BackupMetadata
}

export interface RestoreResult {
    success: boolean
    restored: string[]
    errors: string[]
}

export interface BackupData {
    settings?: JsonObject
    chats?: JsonValue[]
    prompts?: JsonValue[]
    folders?: JsonValue[]
    _metadata: BackupMetadata
    [key: string]: JsonValue | BackupMetadata | undefined
}

export class BackupService {
    private backupDir: string

    constructor(private dataService: DataService) {
        this.backupDir = path.join(dataService.getPath('data'), 'backups')
        this.ensureBackupDir()
    }

    private ensureBackupDir() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true })
        }
    }

    /**
     * Create a backup of settings and data
     */
    async createBackup(options?: {
        includeChats?: boolean
        includeAuth?: boolean
        includeSettings?: boolean
        includePrompts?: boolean
    }): Promise<BackupResult> {
        const opts = {
            includeChats: true,
            includeAuth: false, // Don't include sensitive auth by default
            includeSettings: true,
            includePrompts: true,
            ...options
        }

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            const backupName = `backup-${timestamp}`
            const backupPath = path.join(this.backupDir, `${backupName}.json`)

            const backup: Partial<BackupData> = {}
            const includes: string[] = []

            // Settings
            if (opts.includeSettings) {
                const settingsPath = path.join(this.dataService.getPath('config'), 'settings.json')
                if (fs.existsSync(settingsPath)) {
                    backup.settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
                    includes.push('settings')
                }
            }

            // Chats
            if (opts.includeChats) {
                const chatsPath = path.join(this.dataService.getPath('data'), 'chats.json')
                if (fs.existsSync(chatsPath)) {
                    backup.chats = JSON.parse(fs.readFileSync(chatsPath, 'utf8'))
                    includes.push('chats')
                }
            }

            // Prompts
            if (opts.includePrompts) {
                const promptsPath = path.join(this.dataService.getPath('data'), 'prompts.json')
                if (fs.existsSync(promptsPath)) {
                    backup.prompts = JSON.parse(fs.readFileSync(promptsPath, 'utf8'))
                    includes.push('prompts')
                }
            }

            // Folders
            const foldersPath = path.join(this.dataService.getPath('data'), 'folders.json')
            if (fs.existsSync(foldersPath)) {
                backup.folders = JSON.parse(fs.readFileSync(foldersPath, 'utf8'))
                includes.push('folders')
            }

            // Metadata
            const metadata: BackupMetadata = {
                version: '1.0',
                createdAt: new Date().toISOString(),
                appVersion: process.env.npm_package_version || '1.0.0',
                platform: process.platform,
                includes
            }

            backup._metadata = metadata

            // Write backup
            fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2))

            console.log(`[BackupService] Created backup at ${backupPath}`)

            return {
                success: true,
                path: backupPath,
                metadata
            }
        } catch (error) {
            const msg = getErrorMessage(error as Error)
            console.error('[BackupService] Backup failed:', msg)
            return {
                success: false,
                error: msg
            }
        }
    }

    /**
     * Restore from a backup file
     */
    async restoreBackup(backupPath: string, options?: {
        restoreChats?: boolean
        restoreSettings?: boolean
        restorePrompts?: boolean
        mergChats?: boolean
    }): Promise<RestoreResult> {
        const opts = {
            restoreChats: true,
            restoreSettings: true,
            restorePrompts: true,
            mergeChats: false,
            ...options
        }

        const restored: string[] = []
        const errors: string[] = []

        try {
            if (!fs.existsSync(backupPath)) {
                return { success: false, restored: [], errors: ['Backup file not found'] }
            }

            const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
            const metadata = backup._metadata as BackupMetadata

            if (!metadata) {
                return { success: false, restored: [], errors: ['Invalid backup file: missing metadata'] }
            }

            console.log(`[BackupService] Restoring backup from ${metadata.createdAt}`)

            // Restore settings
            if (opts.restoreSettings && backup.settings) {
                try {
                    const settingsPath = path.join(this.dataService.getPath('config'), 'settings.json')
                    fs.writeFileSync(settingsPath, JSON.stringify(backup.settings, null, 2))
                    restored.push('settings')
                } catch (e) {
                    errors.push(`Settings: ${getErrorMessage(e as Error)}`)
                }
            }

            // Restore chats
            if (opts.restoreChats && backup.chats) {
                try {
                    const chatsPath = path.join(this.dataService.getPath('data'), 'chats.json')

                    if (opts.mergeChats && fs.existsSync(chatsPath)) {
                        const existingChats = JSON.parse(fs.readFileSync(chatsPath, 'utf8')) as { id: string }[]
                        const existingIds = new Set(existingChats.map((c) => c.id))
                        const newChats = (backup.chats as { id: string }[]).filter((c) => !existingIds.has(c.id))
                        const merged = [...existingChats, ...newChats]
                        fs.writeFileSync(chatsPath, JSON.stringify(merged, null, 2))
                        restored.push(`chats (merged ${newChats.length} new)`)
                    } else {
                        fs.writeFileSync(chatsPath, JSON.stringify(backup.chats, null, 2))
                        restored.push('chats')
                    }
                } catch (e) {
                    errors.push(`Chats: ${getErrorMessage(e as Error)}`)
                }
            }

            // Restore prompts
            if (opts.restorePrompts && backup.prompts) {
                try {
                    const promptsPath = path.join(this.dataService.getPath('data'), 'prompts.json')
                    fs.writeFileSync(promptsPath, JSON.stringify(backup.prompts, null, 2))
                    restored.push('prompts')
                } catch (e) {
                    errors.push(`Prompts: ${getErrorMessage(e as Error)}`)
                }
            }

            // Restore folders
            if (backup.folders) {
                try {
                    const foldersPath = path.join(this.dataService.getPath('data'), 'folders.json')
                    fs.writeFileSync(foldersPath, JSON.stringify(backup.folders, null, 2))
                    restored.push('folders')
                } catch (e) {
                    errors.push(`Folders: ${getErrorMessage(e as Error)}`)
                }
            }

            return {
                success: errors.length === 0,
                restored,
                errors
            }
        } catch (error) {
            const msg = getErrorMessage(error as Error)
            return {
                success: false,
                restored,
                errors: [...errors, msg]
            }
        }
    }

    /**
     * List available backups
     */
    listBackups(): Array<{ name: string; path: string; metadata?: BackupMetadata }> {
        const backups: Array<{ name: string; path: string; metadata?: BackupMetadata }> = []

        if (!fs.existsSync(this.backupDir)) {
            return backups
        }

        const files = fs.readdirSync(this.backupDir).filter(f => f.endsWith('.json'))

        for (const file of files) {
            const filePath = path.join(this.backupDir, file)
            try {
                const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
                backups.push({
                    name: file,
                    path: filePath,
                    metadata: content._metadata
                })
            } catch {
                backups.push({ name: file, path: filePath })
            }
        }

        return backups.sort((a, b) => {
            const aTime = a.metadata?.createdAt || ''
            const bTime = b.metadata?.createdAt || ''
            return bTime.localeCompare(aTime)
        })
    }

    /**
     * Delete a backup
     */
    deleteBackup(backupPath: string): boolean {
        try {
            if (fs.existsSync(backupPath)) {
                fs.unlinkSync(backupPath)
                return true
            }
            return false
        } catch {
            return false
        }
    }

    /**
     * Get backup directory path
     */
    getBackupDir(): string {
        return this.backupDir
    }
}
