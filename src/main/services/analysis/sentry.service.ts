// Defer Sentry import to handle Electron's readiness
let Sentry: typeof import('@sentry/electron/main') | null = null;

import { SettingsService } from '@main/services/system/settings.service'
import { JsonValue } from '@shared/types/common'
import { app } from 'electron'

// IMPORTANT: Replace this with your actual Sentry DSN
const SENTRY_DSN = 'https://YOUR_DSN_HERE@o000000.ingest.sentry.io/0000000'

export class SentryService {
    private settingsService: SettingsService
    private isInitialized = false

    constructor(settingsService: SettingsService) {
        this.settingsService = settingsService
    }

    init() {
        const settings = this.settingsService.getSettings()

        // Respect user privacy settings
        if (!settings.crashReporting?.enabled) {
            console.log('[SentryService] Crash reporting is disabled by user.')
            return
        }

        // Don't initialize in development unless forced
        if (!app.isPackaged && !process.env.FORCE_SENTRY_DEV) {
            console.log('[SentryService] Skipping Sentry in development mode.')
            return
        }

        if (this.isInitialized) {
            console.log('[SentryService] Already initialized.')
            return
        }

        try {
            // Lazy load Sentry only when needed and app is ready
            if (!Sentry) {
                Sentry = require('@sentry/electron/main');
            }

            if (Sentry) {
                Sentry.init({
                    dsn: SENTRY_DSN,
                    release: `orbit@${app.getVersion()}`,
                    environment: app.isPackaged ? 'production' : 'development',
                    // User-centric data is stripped by default
                    beforeSend(event) {
                        // Optionally strip PII or sensitive data here
                        return event
                    },
                    // integrations: [Sentry.mainProcessIntegration()]
                })
                this.isInitialized = true
                console.log('[SentryService] Initialized for main process.')
            }
        } catch (error) {
            console.error('[SentryService] Failed to initialize:', error)
        }
    }

    captureException(error: Error, context?: Record<string, JsonValue | Error>) {
        if (!this.isInitialized || !Sentry) { return }
        Sentry.captureException(error, { extra: context })
    }

    captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
        if (!this.isInitialized || !Sentry) { return }
        Sentry.captureMessage(message, level)
    }

    setUser(id: string | null) {
        if (!this.isInitialized || !Sentry) { return }
        Sentry.setUser(id ? { id } : null)
    }

    addBreadcrumb(message: string, category?: string, data?: Record<string, JsonValue | Error>) {
        if (!this.isInitialized || !Sentry) { return }
        Sentry.addBreadcrumb({ message, category, data })
    }
}
