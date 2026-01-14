import * as fs from 'fs'
import * as path from 'path'

import { BaseService } from '@main/services/base.service'
import { getErrorMessage } from '@shared/utils/error.util'
import { app } from 'electron'

export interface AuditLogEntry {
    timestamp: number
    action: string
    category: 'security' | 'settings' | 'authentication' | 'data' | 'system'
    userId?: string
    details?: Record<string, unknown>
    ipAddress?: string
    userAgent?: string
    success: boolean
    error?: string
}

export class AuditLogService extends BaseService {
    private logFilePath: string
    private readonly MAX_LOG_SIZE = 10 * 1024 * 1024 // 10MB
    private readonly MAX_LOG_ENTRIES = 10000

    constructor() {
        super('AuditLogService')
        const userDataPath = app.getPath('userData')
        this.logFilePath = path.join(userDataPath, 'audit.log')
        this.ensureLogFile()
    }

    private ensureLogFile(): void {
        try {
            if (!fs.existsSync(this.logFilePath)) {
                fs.writeFileSync(this.logFilePath, JSON.stringify([]), 'utf8')
            }
        } catch (error) {
            this.logError('AuditLog', `Failed to create audit log file: ${getErrorMessage(error as Error)} `)
        }
    }

    /**
     * Logs a sensitive operation to the audit log
     */
    async log(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
        try {
            const fullEntry: AuditLogEntry = {
                ...entry,
                timestamp: Date.now()
            }

            // Read existing logs
            let logs: AuditLogEntry[] = []
            if (fs.existsSync(this.logFilePath)) {
                try {
                    const content = fs.readFileSync(this.logFilePath, 'utf8')
                    logs = JSON.parse(content)
                    if (!Array.isArray(logs)) {
                        logs = []
                    }
                } catch {
                    logs = []
                }
            }

            // Add new entry
            logs.push(fullEntry)

            // Trim old entries if needed
            if (logs.length > this.MAX_LOG_ENTRIES) {
                logs = logs.slice(-this.MAX_LOG_ENTRIES)
            }

            // Write back to file
            // Logs exported successfully
            // const jsonContent = JSON.stringify(logs, null, 2) // Unused but kept for potential future use

            // Check file size and rotate if needed
            if (fs.existsSync(this.logFilePath)) {
                const stats = fs.statSync(this.logFilePath)
                if (stats.size > this.MAX_LOG_SIZE) {
                    await this.rotateLog()
                    logs = [fullEntry] // Start fresh after rotation
                }
            }

            fs.writeFileSync(this.logFilePath, JSON.stringify(logs, null, 2), 'utf8')

            // Also log to console in development
            if (process.env.NODE_ENV === 'development') {
                this.logInfo('AuditLog', `${entry.category.toUpperCase()}: ${entry.action} - ${entry.success ? 'SUCCESS' : 'FAILED'} `)
            }
        } catch (error) {
            this.logError('AuditLog', `Failed to write audit log: ${getErrorMessage(error as Error)} `)
        }
    }

    /**
     * Retrieves audit log entries with optional filtering
     */
    async getLogs(options?: {
        category?: AuditLogEntry['category']
        startDate?: number
        endDate?: number
        limit?: number
    }): Promise<AuditLogEntry[]> {
        try {
            if (!fs.existsSync(this.logFilePath)) {
                return []
            }

            const content = fs.readFileSync(this.logFilePath, 'utf8')
            let logs: AuditLogEntry[] = JSON.parse(content)

            if (!Array.isArray(logs)) {
                return []
            }

            // Apply filters
            if (options?.category) {
                logs = logs.filter(log => log.category === options.category)
            }

            if (options?.startDate) {
                logs = logs.filter(log => log.timestamp >= options.startDate!)
            }

            if (options?.endDate) {
                logs = logs.filter(log => log.timestamp <= options.endDate!)
            }

            // Sort by timestamp (newest first)
            logs.sort((a, b) => b.timestamp - a.timestamp)

            // Apply limit
            if (options?.limit) {
                logs = logs.slice(0, options.limit)
            }

            return logs
        } catch (error) {
            this.logError('AuditLog', `Failed to read audit log: ${getErrorMessage(error as Error)} `)
            return []
        }
    }

    /**
     * Rotates the audit log file
     */
    private async rotateLog(): Promise<void> {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            const rotatedPath = `${this.logFilePath}.${timestamp} `

            if (fs.existsSync(this.logFilePath)) {
                fs.renameSync(this.logFilePath, rotatedPath)
            }

            // Keep only last 5 rotated logs
            const logDir = path.dirname(this.logFilePath)
            const logBaseName = path.basename(this.logFilePath)
            const files = fs.readdirSync(logDir)
                .filter(f => f.startsWith(logBaseName) && f !== logBaseName)
                .map(f => ({
                    name: f,
                    path: path.join(logDir, f),
                    mtime: fs.statSync(path.join(logDir, f)).mtimeMs
                }))
                .sort((a, b) => b.mtime - a.mtime)

            // Remove old rotated logs
            for (let i = 5; i < files.length; i++) {
                fs.unlinkSync(files[i].path)
            }
        } catch (error) {
            this.logError('AuditLog', `Failed to rotate audit log: ${getErrorMessage(error as Error)} `)
        }
    }

    /**
     * Clears audit logs (use with caution)
     */
    async clearLogs(): Promise<void> {
        try {
            if (fs.existsSync(this.logFilePath)) {
                fs.writeFileSync(this.logFilePath, JSON.stringify([]), 'utf8')
            }
            this.logInfo('AuditLog', 'Audit logs cleared')
        } catch (error) {
            this.logError('AuditLog', `Failed to clear audit log: ${getErrorMessage(error as Error)} `)
        }
    }
}

