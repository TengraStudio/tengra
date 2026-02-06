// Defer Sentry import to handle Electron's readiness
let Sentry: typeof import('@sentry/electron/main') | null = null;

import { appLogger } from '@main/logging/logger';
import { SettingsService } from '@main/services/system/settings.service';
import { JsonValue } from '@shared/types/common';
import { app } from 'electron';

// Sentry DSN loaded from environment variable for security
const SENTRY_DSN = process.env.SENTRY_DSN ?? '';

export class SentryService {
    private settingsService: SettingsService;
    private isInitialized = false;

    constructor(settingsService: SettingsService) {
        this.settingsService = settingsService;
    }

    async init() {
        const settings = this.settingsService.getSettings();

        // Respect user privacy settings
        if (!settings.crashReporting?.enabled) {
            appLogger.info('SentryService', 'Crash reporting is disabled by user.');
            return;
        }

        // Validate DSN is configured
        if (!SENTRY_DSN) {
            appLogger.info('SentryService', 'Sentry DSN not configured (set SENTRY_DSN environment variable).');
            return;
        }

        // Don't initialize in development unless forced
        if (!app.isPackaged && !process.env.FORCE_SENTRY_DEV) {
            appLogger.info('SentryService', 'Skiing Sentry in development mode.');
            return;
        }

        if (this.isInitialized) {
            appLogger.info('SentryService', 'Already initialized.');
            return;
        }

        try {
            // Lazy load Sentry only when needed and app is ready
            if (!Sentry) {
                const SentryModule = await import('@sentry/electron/main');
                Sentry = SentryModule;
            }

            Sentry.init({
                dsn: SENTRY_DSN,
                release: `tandem@${app.getVersion()}`,
                environment: app.isPackaged ? 'production' : 'development',
                // User-centric data is stripped by default
                beforeSend(event) {
                    // Optionally strip PII or sensitive data here
                    return event;
                },
                // integrations: [Sentry.mainProcessIntegration()]
            });
            this.isInitialized = true;
            appLogger.info('SentryService', 'Initialized for main process.');
        } catch (error) {
            appLogger.error('SentryService', 'Failed to initialize:', error as Error);
        }
    }

    captureException(error: Error, context?: Record<string, JsonValue | Error>) {
        if (!this.isInitialized || !Sentry) { return; }
        Sentry.captureException(error, { extra: context });
    }

    captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
        if (!this.isInitialized || !Sentry) { return; }
        Sentry.captureMessage(message, level);
    }

    setUser(id: string | null) {
        if (!this.isInitialized || !Sentry) { return; }
        Sentry.setUser(id ? { id } : null);
    }

    addBreadcrumb(message: string, category?: string, data?: Record<string, JsonValue | Error>) {
        if (!this.isInitialized || !Sentry) { return; }
        Sentry.addBreadcrumb({ message, category, data });
    }
}
