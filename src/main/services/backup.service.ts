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

export interface AutoBackupConfig {
    enabled: boolean
    intervalHours: number
    maxBackups: number
    lastBackup: string | null
}

const DEFAULT_AUTO_BACKUP_CONFIG: AutoBackupConfig = {
    enabled: false,
    intervalHours: 24,
    maxBackups: 10,
    lastBackup: null
}

export class BackupService {
    private backupDir: string
    private autoBackupTimer: ReturnType<typeof setInterval> | null = null
    private autoBackupConfig: AutoBackupConfig = { ...DEFAULT_AUTO_BACKUP_CONFIG }
    private configPath: string

    constructor(private dataService: DataService) {
        this.backupDir = path.join(dataService.getPath('data'), 'backups')
        this.configPath = path.join(dataService.getPath('config'), 'backup-config.json')
        this.ensureBackupDir()
        this.loadAutoBackupConfig()
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
        mergeChats?: boolean
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

    /**
     * Load auto-backup configuration from disk
     */
    private loadAutoBackupConfig(): void {
        try {
            if (fs.existsSync(this.configPath)) {
                const content = fs.readFileSync(this.configPath, 'utf8')
                const loaded = JSON.parse(content) as Partial<AutoBackupConfig>
                this.autoBackupConfig = { ...DEFAULT_AUTO_BACKUP_CONFIG, ...loaded }

                // Start auto-backup if enabled
                if (this.autoBackupConfig.enabled) {
                    this.startAutoBackup()
                }
            }
        } catch (error) {
            console.error('[BackupService] Failed to load auto-backup config:', getErrorMessage(error as Error))
        }
    }

    /**
     * Save auto-backup configuration to disk
     */
    private saveAutoBackupConfig(): void {
        try {
            const configDir = path.dirname(this.configPath)
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true })
            }
            fs.writeFileSync(this.configPath, JSON.stringify(this.autoBackupConfig, null, 2))
        } catch (error) {
            console.error('[BackupService] Failed to save auto-backup config:', getErrorMessage(error as Error))
        }
    }

    /**
     * Get auto-backup status
     */
    getAutoBackupStatus(): AutoBackupConfig {
        return { ...this.autoBackupConfig }
    }

    /**
     * Configure auto-backup settings
     */
    configureAutoBackup(config: {
        enabled: boolean
        intervalHours?: number
        maxBackups?: number
    }): void {
        const wasEnabled = this.autoBackupConfig.enabled

        this.autoBackupConfig.enabled = config.enabled
        if (config.intervalHours !== undefined) {
            this.autoBackupConfig.intervalHours = Math.max(1, config.intervalHours) // Minimum 1 hour
        }
        if (config.maxBackups !== undefined) {
            this.autoBackupConfig.maxBackups = Math.max(1, config.maxBackups) // Minimum 1 backup
        }

        this.saveAutoBackupConfig()

        // Handle timer based on enabled state change
        if (config.enabled && !wasEnabled) {
            this.startAutoBackup()
        } else if (!config.enabled && wasEnabled) {
            this.stopAutoBackup()
        } else if (config.enabled && wasEnabled && config.intervalHours !== undefined) {
            // Restart with new interval
            this.stopAutoBackup()
            this.startAutoBackup()
        }
    }

    /**
     * Start automatic backup timer
     */
    private startAutoBackup(): void {
        if (this.autoBackupTimer) {
            return // Already running
        }

        const intervalMs = this.autoBackupConfig.intervalHours * 60 * 60 * 1000
        console.log(`[BackupService] Starting auto-backup every ${this.autoBackupConfig.intervalHours} hours`)

        // Check if we need to run a backup immediately (if last backup is too old)
        this.checkAndRunBackup()

        this.autoBackupTimer = setInterval(() => {
            this.checkAndRunBackup()
        }, intervalMs)
    }

    /**
     * Stop automatic backup timer
     */
    private stopAutoBackup(): void {
        if (this.autoBackupTimer) {
            clearInterval(this.autoBackupTimer)
            this.autoBackupTimer = null
            console.log('[BackupService] Stopped auto-backup')
        }
    }

    /**
     * Check if a backup is needed and run it
     */
    private async checkAndRunBackup(): Promise<void> {
        const lastBackup = this.autoBackupConfig.lastBackup
        const intervalMs = this.autoBackupConfig.intervalHours * 60 * 60 * 1000

        if (lastBackup) {
            const lastBackupTime = new Date(lastBackup).getTime()
            const now = Date.now()
            if (now - lastBackupTime < intervalMs) {
                // Not time for a backup yet
                return
            }
        }

        console.log('[BackupService] Running scheduled auto-backup')
        const result = await this.createBackup()

        if (result.success) {
            this.autoBackupConfig.lastBackup = new Date().toISOString()
            this.saveAutoBackupConfig()

            // Clean up old backups
            this.cleanupOldBackups()
        }
    }

    /**
     * Clean up old backups, keeping only the configured number of most recent backups
     */
    cleanupOldBackups(): number {
        const backups = this.listBackups()
        const maxBackups = this.autoBackupConfig.maxBackups

        if (backups.length <= maxBackups) {
            return 0
        }

        // Backups are sorted by date (newest first), so delete from the end
        const toDelete = backups.slice(maxBackups)
        let deleted = 0

        for (const backup of toDelete) {
            if (this.deleteBackup(backup.path)) {
                deleted++
                console.log(`[BackupService] Deleted old backup: ${backup.name}`)
            }
        }

        return deleted
    }

    /**
     * Stop the service and clean up resources
     */
    dispose(): void {
        this.stopAutoBackup()
    }
}
