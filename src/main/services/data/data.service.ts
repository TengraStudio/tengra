import * as fs from 'fs'
import * as path from 'path'

import { appLogger } from '@main/logging/logger'
import { BaseService } from '@main/services/base.service'
import { getErrorMessage } from '@shared/utils/error.util'
import { app } from 'electron'

export type DataType = 'auth' | 'db' | 'config' | 'logs' | 'models' | 'gallery' | 'galleryImages' | 'galleryVideos' | 'data'

export class DataService extends BaseService {
    private baseDir: string
    private paths: Record<DataType, string>

    constructor() {
        super('DataService')

        // Use standard AppData/Orbit/data structure
        // app.getPath('userData') usually points to AppData/Roaming/Orbit (or similar)
        // We want to organize things cleanly inside it.
        const userData = app.getPath('userData')
        this.baseDir = path.join(userData, 'data')





        this.paths = {
            auth: path.join(this.baseDir, 'auth'),
            db: path.join(userData, 'db'),
            config: path.join(this.baseDir, 'config'),
            logs: path.join(this.baseDir, 'logs'),
            models: path.join(this.baseDir, 'models'),
            data: this.baseDir, // Base data directory
            gallery: path.join(this.baseDir, 'gallery'),
            galleryImages: path.join(this.baseDir, 'gallery', 'images'),
            galleryVideos: path.join(this.baseDir, 'gallery', 'videos')
        }
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing data service and ensuring directory structure...')
        
        try {
            this.ensureDirectories()
            this.logInfo('Data service initialized successfully')
        } catch (error) {
            this.logError('Failed to initialize data service', error)
            throw error
        }
    }

    async cleanup(): Promise<void> {
        this.logInfo('Data service cleanup - no resources to clean')
    }

    private ensureDirectories() {
        if (!fs.existsSync(this.baseDir)) {fs.mkdirSync(this.baseDir, { recursive: true })}
        Object.values(this.paths).forEach(p => {
            if (!fs.existsSync(p)) {fs.mkdirSync(p, { recursive: true })}
        })
    }

    getPath(type: DataType): string {
        return this.paths[type]
    }

    /**
     * One-time migration to move files from old locations to new centralized locations.
     * Should be called on app startup.
     */
    async migrate() {
        const userData = app.getPath('userData') // Orbit/runtime
        const rootPath = path.dirname(userData)  // Orbit

        const migrations = [
            // Auth: root/auth -> data/auth
            {
                old: path.join(rootPath, 'auth'),
                new: this.paths.auth,
                isDir: true
            },
            // Encrypted Token: root/cliproxy-auth.enc -> data/auth/proxy-auth-token.enc
            {
                old: path.join(rootPath, 'cliproxy-auth.enc'),
                new: path.join(this.paths.auth, 'proxy-auth-token.enc'),
                isDir: false
            },
            // Legacy Migration: root/cliproxy-auth-work -> data/auth
            {
                old: path.join(rootPath, 'cliproxy-auth-work'),
                new: this.paths.auth,
                isDir: true
            },
            // DB: root/orbit-lancedb -> data/db/vector-store (Renamed from orbit-lancedb)
            {
                old: path.join(rootPath, 'orbit-lancedb'),
                new: path.join(this.paths.db, 'vector-store'),
                isDir: true
            },
            // DB: runtime/data/db/orbit-lancedb -> data/db/vector-store (Rename if already migrated)
            {
                old: path.join(this.paths.db, 'orbit-lancedb'),
                new: path.join(this.paths.db, 'vector-store'),
                isDir: true
            },
            // SQLite: root/databases -> data/db
            // We move the contents of root/databases to data/db
            {
                old: path.join(rootPath, 'databases'),
                new: this.paths.db,
                isDir: true
            },
            // Settings: root/settings.json -> data/config/settings.json
            {
                old: path.join(rootPath, 'settings.json'),
                new: path.join(this.paths.config, 'settings.json'),
                isDir: false
            },
            // Proxy Config: root/proxy-config.yaml -> data/config/proxy-config.yaml
            {
                old: path.join(rootPath, 'proxy-config.yaml'),
                new: path.join(this.paths.config, 'proxy-config.yaml'),
                isDir: false
            },
            // Models: root/models -> data/models
            {
                old: path.join(rootPath, 'models'),
                new: this.paths.models,
                isDir: true
            },
            // Static: root/static -> runtime/static
            // We assume static files should be in runtime/static as app assets
            {
                old: path.join(rootPath, 'static'),
                new: path.join(userData, 'static'),
                isDir: true
            },
            // Gallery: Pictures/Orbit/Gallery -> gallery/images (External path)
            {
                old: path.join(app.getPath('pictures'), 'Orbit', 'Gallery'),
                new: this.paths.galleryImages,
                isDir: true
            }
        ]

        appLogger.info('DataService', 'Checking for migrations...')

        for (const m of migrations) {
            try {
                if (!fs.existsSync(m.old)) { continue }

                if (m.isDir) {
                    this.migrateDirectory(m.old, m.new)
                } else {
                    this.migrateFile(m.old, m.new)
                }
            } catch (error) {
                appLogger.error('DataService', `Failed to migrate ${m.old}: ${getErrorMessage(error as Error)}`)
            }
        }

        // Cleanup: Remove legacy .cli-proxy-api folder from Root
        try {
            const legacyPath = path.join(rootPath, '.cli-proxy-api')
            if (fs.existsSync(legacyPath)) {
                appLogger.info('DataService', 'Cleaning up legacy .cli-proxy-api folder')
                fs.rmSync(legacyPath, { recursive: true, force: true })
            }
        } catch (e) {
            appLogger.error('DataService', `Failed to cleanup legacy folder: ${getErrorMessage(e as Error)}`)
        }
    }

    private migrateDirectory(oldPath: string, newPath: string): void {
        if (!fs.existsSync(newPath)) {
            fs.mkdirSync(newPath, { recursive: true })
        }

        const files = fs.readdirSync(oldPath)
        for (const file of files) {
            const oldFile = path.join(oldPath, file)
            const newFile = path.join(newPath, file)
            if (fs.existsSync(newFile)) { continue }
            appLogger.info('DataService', `Migrating file ${file} to ${newPath}`)
            fs.renameSync(oldFile, newFile)
        }

        // Try to remove old dir if empty
        try {
            if (fs.readdirSync(oldPath).length === 0) {
                fs.rmdirSync(oldPath)
            }
        } catch {
            // Ignore error during cleanup of empty dir
        }
    }

    private migrateFile(oldPath: string, newPath: string): void {
        if (fs.existsSync(newPath)) { return }
        appLogger.info('DataService', `Migrating ${path.basename(oldPath)} to ${newPath}`)
        const destDir = path.dirname(newPath)
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true })
        }
        fs.renameSync(oldPath, newPath)
    }
}
