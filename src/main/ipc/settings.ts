import { appLogger } from '@main/logging/logger';
import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { CopilotService } from '@main/services/llm/copilot.service';
import { LLMService } from '@main/services/llm/llm.service';
import { SettingsService } from '@main/services/system/settings.service';
import { registerBatchableHandler } from '@main/utils/ipc-batch.util';
import { createIpcHandler, createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { IpcValue } from '@shared/types/common';
import { AppSettings } from '@shared/types/settings';
import { getErrorMessage } from '@shared/utils/error.util';
import { app, BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';

const MAX_SECRET_LENGTH = 4096;
const settingsCredentialSchema = z.object({
    apiKey: z.string().max(MAX_SECRET_LENGTH).optional(),
    token: z.string().max(MAX_SECRET_LENGTH).optional(),
    key: z.string().max(MAX_SECRET_LENGTH).optional()
}).passthrough();

const SETTINGS_ERROR_CODE = {
    VALIDATION: 'SETTINGS_VALIDATION_ERROR',
    SAVE_FAILED: 'SETTINGS_SAVE_FAILED',
} as const;

const SETTINGS_MESSAGE_KEY = {
    VALIDATION: 'errors.settings.validation',
    SAVE_FAILED: 'errors.settings.saveFailed',
} as const;

const SETTINGS_PERFORMANCE_BUDGET_MS = {
    GET: 40,
    SAVE: 150
} as const;
const MAX_SETTINGS_TELEMETRY_EVENTS = 120;

const getSettingsErrorCode = (error: Error): string => {
    if (error instanceof z.ZodError) {
        return SETTINGS_ERROR_CODE.VALIDATION;
    }
    return SETTINGS_ERROR_CODE.SAVE_FAILED;
};

const getSettingsMessageKey = (code: string): string => {
    if (code === SETTINGS_ERROR_CODE.VALIDATION) {
        return SETTINGS_MESSAGE_KEY.VALIDATION;
    }
    return SETTINGS_MESSAGE_KEY.SAVE_FAILED;
};

const formatSettingsError = (error: Error, code: string) => ({
    success: false,
    error: {
        message: getErrorMessage(error),
        code,
        messageKey: getSettingsMessageKey(code),
        uiState: 'failure'
    }
});

// Define a stricter schema for AppSettings to prevent injection or invalid state
const AppSettingsSchema = z.object({
    general: z.object({
        language: z.enum(['tr', 'en', 'de', 'fr', 'es', 'ja', 'zh', 'ar']).optional(),
        telemetryEnabled: z.boolean().optional()
    }).passthrough().optional(),
    openai: settingsCredentialSchema.optional(),
    anthropic: settingsCredentialSchema.optional(),
    groq: settingsCredentialSchema.optional(),
    github: settingsCredentialSchema.optional(),
    copilot: settingsCredentialSchema.optional(),
}).passthrough();

/**
 * Synchronizes the OS login item settings based on application startup preferences.
 * @param settings - The application settings containing startup behavior configuration
 */
function syncStartupBehavior(settings: AppSettings): void {
    if (!app.isPackaged || settings.window?.startOnStartup === undefined) {
        return;
    }

    const shouldStartHidden = settings.window.workAtBackground ?? false;
    app.setLoginItemSettings({
        openAtLogin: settings.window.startOnStartup,
        openAsHidden: shouldStartHidden,
        path: process.execPath,
        args: shouldStartHidden ? ['--hidden'] : []
    });
}

/**
 * Registers IPC handlers for application settings management including get, save, and credential updates.
 * @param options - Configuration object containing service dependencies and connection update callbacks
 */
export function registerSettingsIpc(options: {
    getMainWindow: () => BrowserWindow | null
    settingsService: SettingsService
    llmService: LLMService
    copilotService: CopilotService
    auditLogService?: AuditLogService
    updateOpenAIConnection: () => void
    updateOllamaConnection: () => void | Promise<void>
}) {
    const { getMainWindow, settingsService, llmService, copilotService, auditLogService, updateOpenAIConnection, updateOllamaConnection } = options;
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'settings operation');
    const settingsTelemetry = {
        getCount: 0,
        saveCount: 0,
        saveFailureCount: 0,
        validationFailureCount: 0,
        retryCount: 0,
        budgetExceededCount: 0,
        lastGetDurationMs: 0,
        lastSaveDurationMs: 0,
        lastErrorCode: '' as string | null,
        events: [] as Array<{ event: string; timestamp: number; durationMs?: number; code?: string }>
    };
    const trackSettingsEvent = (event: string, details: { durationMs?: number; code?: string } = {}) => {
        settingsTelemetry.events = [...settingsTelemetry.events, {
            event,
            timestamp: Date.now(),
            durationMs: details.durationMs,
            code: details.code
        }].slice(-MAX_SETTINGS_TELEMETRY_EVENTS);
    };
    const trackSettingsBudget = (durationMs: number, budgetMs: number) => {
        if (durationMs > budgetMs) {
            settingsTelemetry.budgetExceededCount += 1;
        }
    };
    const getSettingsHealthSummary = () => {
        const operationCount = settingsTelemetry.getCount + settingsTelemetry.saveCount;
        const errorCount = settingsTelemetry.saveFailureCount + settingsTelemetry.validationFailureCount;
        const errorRate = operationCount === 0 ? 0 : errorCount / operationCount;
        const status = errorRate > 0.05 || settingsTelemetry.budgetExceededCount > 0 ? 'degraded' : 'healthy';

        return {
            status,
            uiState: status === 'healthy' ? 'ready' : 'failure',
            metrics: {
                ...settingsTelemetry,
                errorRate
            },
            budgets: {
                getMs: SETTINGS_PERFORMANCE_BUDGET_MS.GET,
                saveMs: SETTINGS_PERFORMANCE_BUDGET_MS.SAVE
            }
        };
    };

    const sensitiveFields = [
        { key: 'openai', label: 'OpenAI API key' },
        { key: 'anthropic', label: 'Anthropic API key' },
        { key: 'groq', label: 'Groq API key' },
        { key: 'nvidia', label: 'NVIDIA API key' },
        { key: 'github', label: 'GitHub token' },
        { key: 'copilot', label: 'Copilot token' },
        { key: 'proxy', label: 'Proxy key' }
    ] as const;

    function getSensitiveValue(settings: AppSettings, fieldKey: typeof sensitiveFields[number]['key']): string | undefined {
        const providerSettings = settings[fieldKey] as Record<string, unknown> | undefined;
        const keyCandidate = providerSettings?.['apiKey'] ?? providerSettings?.['token'] ?? providerSettings?.['key'];
        return typeof keyCandidate === 'string' ? keyCandidate : undefined;
    }

    function getConfiguredApiKeyProviders(settings: AppSettings): string[] {
        return sensitiveFields
            .map(field => field.key)
            .filter(fieldKey => {
                const value = getSensitiveValue(settings, fieldKey);
                return typeof value === 'string' && value.trim().length > 0;
            });
    }

    async function logApiKeyReadAccess(settings: AppSettings, source: 'batch' | 'invoke') {
        if (!auditLogService) { return; }
        const providers = getConfiguredApiKeyProviders(settings);
        if (providers.length === 0) { return; }
        await auditLogService.logApiKeyAccess('settings.api-key.read', true, {
            source,
            providers,
            providerCount: providers.length
        });
    }

    /**
     * Logs audit entries when sensitive settings fields (API keys) are modified.
     */
    async function auditSensitiveChanges(newSettings: AppSettings, oldSettings: AppSettings, auditService: AuditLogService | undefined) {
        if (!auditService) { return; }
        const sensitiveChanges: string[] = [];
        const changedProviders: string[] = [];

        for (const field of sensitiveFields) {
            checkSensitiveField(field, newSettings, oldSettings, sensitiveChanges, changedProviders);
        }

        if (sensitiveChanges.length > 0) {
            await auditService.log({
                action: 'Settings updated',
                category: 'settings',
                success: true,
                details: { changes: sensitiveChanges, changedFields: Object.keys(newSettings) }
            });
        }

        for (const provider of changedProviders) {
            await auditService.logApiKeyAccess('settings.api-key.updated', true, {
                provider,
                source: 'settings:save'
            });
        }
    }

    function checkSensitiveField(
        field: typeof sensitiveFields[number],
        newSettings: AppSettings,
        oldSettings: AppSettings,
        changes: string[],
        changedProviders: string[]
    ) {
        const newVal = getSensitiveValue(newSettings, field.key);
        const oldVal = getSensitiveValue(oldSettings, field.key);

        if (typeof newVal === 'string' && newVal !== oldVal) {
            changes.push(`${field.label} updated`);
            changedProviders.push(field.key);
        }
    }

    function updateServices(finalSettings: AppSettings, newSettings: AppSettings) {
        if (finalSettings.openai?.apiKey) { llmService.setOpenAIApiKey(finalSettings.openai.apiKey); }
        if (finalSettings.anthropic?.apiKey) { llmService.setAnthropicApiKey(finalSettings.anthropic.apiKey); }
        if (newSettings.groq) { llmService.setGroqApiKey(newSettings.groq.apiKey); }
        if (finalSettings.copilot?.token) { copilotService.setCopilotToken(finalSettings.copilot.token); }
        if (finalSettings.github?.token) { copilotService.setGithubToken(finalSettings.github.token); }
    }

    // Shared logic for saving settings (used by both batch and direct IPC)
    async function handleSaveSettingsImplementation(newSettings: AppSettings) {
        const oldSettings = settingsService.getSettings();
        const startedAt = Date.now();
        try {
            let finalSettings = oldSettings;
            let saveError: Error | null = null;
            for (let attempt = 0; attempt < 2; attempt += 1) {
                try {
                    finalSettings = await settingsService.saveSettings(newSettings);
                    saveError = null;
                    break;
                } catch (error) {
                    saveError = error as Error;
                    if (attempt === 0) {
                        settingsTelemetry.retryCount += 1;
                        trackSettingsEvent('settings.save.retry');
                        await new Promise(resolve => setTimeout(resolve, 25));
                    }
                }
            }
            if (saveError) {
                throw saveError;
            }

            const durationMs = Date.now() - startedAt;
            settingsTelemetry.saveCount += 1;
            settingsTelemetry.lastSaveDurationMs = durationMs;
            trackSettingsBudget(durationMs, SETTINGS_PERFORMANCE_BUDGET_MS.SAVE);
            trackSettingsEvent('settings.save.success', { durationMs });

            syncStartupBehavior(finalSettings);

            await auditSensitiveChanges(newSettings, oldSettings, auditLogService);

            void (async () => {
                try {
                    await updateOllamaConnection();
                } catch (error) {
                    appLogger.error('IPC', 'updateOllamaConnection failed:', error as Error);
                }
            })();

            updateServices(finalSettings, newSettings);
            updateOpenAIConnection();

            return finalSettings;
        } catch (error) {
            const durationMs = Date.now() - startedAt;
            const errorCode = getSettingsErrorCode(error as Error);
            settingsTelemetry.saveFailureCount += 1;
            settingsTelemetry.lastErrorCode = errorCode;
            settingsTelemetry.lastSaveDurationMs = durationMs;
            trackSettingsBudget(durationMs, SETTINGS_PERFORMANCE_BUDGET_MS.SAVE);
            trackSettingsEvent('settings.save.failed', { durationMs, code: errorCode });
            await auditLogService?.logApiKeyAccess('settings.api-key.update-failed', false, {
                reason: (error as Error).message
            });
            throw error;
        }
    }

    // Register batchable settings handlers
    registerBatchableHandler('getSettings', async (): Promise<IpcValue> => {
        const settings = settingsService.getSettings();
        await logApiKeyReadAccess(settings, 'batch');
        return settings;
    });

    // Validated batch handler
    const validatedSaveHandler = createValidatedIpcHandler<{ success: boolean }, [AppSettings]>(
        'saveSettings',
        async (_event, settings) => {
            await handleSaveSettingsImplementation(settings);
            return { success: true };
        },
        {
            argsSchema: z.tuple([AppSettingsSchema]),
            onError: (error) => formatSettingsError(error, getSettingsErrorCode(error)),
            responseSchema: z.object({ success: z.boolean() }),
            onValidationFailed: () => {
                settingsTelemetry.validationFailureCount += 1;
                settingsTelemetry.lastErrorCode = SETTINGS_ERROR_CODE.VALIDATION;
                trackSettingsEvent('settings.save.validation-failed', {
                    code: SETTINGS_ERROR_CODE.VALIDATION
                });
                appLogger.warn('SettingsIPC', 'Settings batch validation failed');
            }
        }
    );

    registerBatchableHandler('saveSettings', validatedSaveHandler);

    ipcMain.handle('settings:get', createIpcHandler('settings:get', async (event) => {
        validateSender(event);
        const startedAt = Date.now();
        const settings = settingsService.getSettings();
        await logApiKeyReadAccess(settings, 'invoke');
        const durationMs = Date.now() - startedAt;
        settingsTelemetry.getCount += 1;
        settingsTelemetry.lastGetDurationMs = durationMs;
        trackSettingsBudget(durationMs, SETTINGS_PERFORMANCE_BUDGET_MS.GET);
        trackSettingsEvent('settings.get.success', { durationMs });
        return settings;
    }));

    ipcMain.handle('settings:health', createIpcHandler(
        'settings:health',
        async (event) => { validateSender(event); return getSettingsHealthSummary(); },
        { wrapResponse: true }
    ));

    ipcMain.handle('settings:save', createValidatedIpcHandler<AppSettings, [AppSettings]>(
        'settings:save',
        async (event, settings) => {
            validateSender(event);
            return await handleSaveSettingsImplementation(settings);
        },
        {
            argsSchema: z.tuple([AppSettingsSchema]),
            wrapResponse: true,
            onError: (error) => formatSettingsError(error, getSettingsErrorCode(error)),
            onValidationFailed: () => {
                settingsTelemetry.validationFailureCount += 1;
                settingsTelemetry.lastErrorCode = SETTINGS_ERROR_CODE.VALIDATION;
                trackSettingsEvent('settings.save.validation-failed', {
                    code: SETTINGS_ERROR_CODE.VALIDATION
                });
                appLogger.warn('SettingsIPC', 'Settings validation failed');
            }
        }
    ));
}
