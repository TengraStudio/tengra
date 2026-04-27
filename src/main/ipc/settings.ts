/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { CopilotService } from '@main/services/llm/copilot.service';
import { LLMService } from '@main/services/llm/llm.service';
import { SettingsService } from '@main/services/system/settings.service';
import { t } from '@main/utils/i18n.util';
import { registerBatchableHandler } from '@main/utils/ipc-batch.util';
import { createIpcHandler, createValidatedIpcHandler, safeHandle } from '@main/utils/ipc-wrapper.util';
import { IpcValue } from '@shared/types/common';
import { AppSettings } from '@shared/types/settings';
import { TengraError } from '@shared/utils/error.util';
import { app, BrowserWindow } from 'electron';
import { z } from 'zod';

const MAX_SECRET_LENGTH = 4096;
const antigravityCreditUsageModeSchema = z.enum(['auto', 'ask-every-time']);
const settingsCredentialSchema = z.object({
    apiKey: z.string().max(MAX_SECRET_LENGTH).optional(),
    token: z.string().max(MAX_SECRET_LENGTH).optional(),
    key: z.string().max(MAX_SECRET_LENGTH).optional()
}).passthrough();

const SETTINGS_ERROR_CODE = {
    VALIDATION: 'SETTINGS_VALIDATION_ERROR',
    SAVE_FAILED: 'SETTINGS_SAVE_FAILED',
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





// Define a stricter schema for AppSettings to prevent injection or invalid state
const AppSettingsSchema = z.object({
    general: z.object({
        language: z.string().min(2).max(32).regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/).optional(),
        telemetryEnabled: z.boolean().optional()
    }).passthrough().optional(),
    openai: settingsCredentialSchema.optional(),
    anthropic: settingsCredentialSchema.optional(),
    groq: settingsCredentialSchema.optional(),
    nvidia: settingsCredentialSchema.optional(),
    github: settingsCredentialSchema.optional(),
    copilot: settingsCredentialSchema.optional(),
    antigravity: settingsCredentialSchema.extend({
        connected: z.boolean().optional(),
        creditUsageModeByAccount: z.record(z.string(), antigravityCreditUsageModeSchema).optional()
    }).optional(),
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

    updateOpenAIConnection: () => void
    updateOllamaConnection: () => void | Promise<void>
}) {
    const { getMainWindow, settingsService, updateOpenAIConnection, updateOllamaConnection } = options;
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
        { key: 'openai', label: t('auto.openaiApiKey') },
        { key: 'anthropic', label: t('auto.anthropicApiKey') },
        { key: 'groq', label: t('auto.groqApiKey') },
        { key: 'nvidia', label: t('auto.nvidiaApiKey') },
        { key: 'github', label: t('auto.githubToken') },
        { key: 'copilot', label: t('auto.copilotToken') },
        { key: 'proxy', label: t('auto.proxyKey') }
    ] as const;

    function getSensitiveValue(settings: AppSettings, fieldKey: typeof sensitiveFields[number]['key']): string | undefined {
        const providerSettings = settings[fieldKey] as Record<string, string | number | boolean | undefined> | undefined;
        const keyCandidate = providerSettings?.['apiKey'] ?? providerSettings?.['token'] ?? providerSettings?.['key'];
        return typeof keyCandidate === 'string' ? keyCandidate : undefined;
    }

    // Note: getConfiguredApiKeyProviders was unused and removed.

    function updateServices(finalSettings: AppSettings, newSettings: AppSettings) {
        void newSettings;
        void finalSettings;
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

            updateServices(finalSettings, newSettings);
            updateOpenAIConnection();
            void updateOllamaConnection();

            return finalSettings;
        } catch (error) {
            const durationMs = Date.now() - startedAt;
            const errorCode = getSettingsErrorCode(error as Error);
            settingsTelemetry.saveFailureCount += 1;
            settingsTelemetry.lastErrorCode = errorCode;
            settingsTelemetry.lastSaveDurationMs = durationMs;
            trackSettingsBudget(durationMs, SETTINGS_PERFORMANCE_BUDGET_MS.SAVE);
            trackSettingsEvent('settings.save.failed', { durationMs, code: errorCode });
            throw error;
        }
    }

    // Register batchable settings handlers
    registerBatchableHandler('getSettings', createIpcHandler('getSettings', async (): Promise<IpcValue> => {
        const settings = settingsService.getSettings();
        return settings;
    }, { wrapResponse: true }));

    // Validated batch handler
    const validatedSaveHandler = createValidatedIpcHandler<void, [AppSettings]>(
        'saveSettings',
        async (_event, settings) => {
            await handleSaveSettingsImplementation(settings);
        },
        {
            argsSchema: z.tuple([AppSettingsSchema]),
            wrapResponse: true,
            onError: (error) => {
                throw new TengraError(error.message, 'SETTINGS_SAVE_FAILED');
            },
            onValidationFailed: () => {
                settingsTelemetry.validationFailureCount += 1;
                settingsTelemetry.lastErrorCode = SETTINGS_ERROR_CODE.VALIDATION;
                trackSettingsEvent('settings.save.validation-failed', {
                    code: SETTINGS_ERROR_CODE.VALIDATION
                });
                appLogger.warn('SettingsIPC', 'Settings batch validation failed');
                throw new TengraError('Validation failed', 'SETTINGS_VALIDATION_ERROR');
            }
        }
    );

    registerBatchableHandler('saveSettings', validatedSaveHandler);

    safeHandle('settings:get', createIpcHandler('settings:get', async (event) => {
        validateSender(event);
        const startedAt = Date.now();
        const settings = settingsService.getSettings();
        const durationMs = Date.now() - startedAt;
        settingsTelemetry.getCount += 1;
        settingsTelemetry.lastGetDurationMs = durationMs;
        trackSettingsBudget(durationMs, SETTINGS_PERFORMANCE_BUDGET_MS.GET);
        trackSettingsEvent('settings.get.success', { durationMs });
        return settings;
    }, { wrapResponse: true }), false);

    safeHandle('settings:health', createIpcHandler(
        'settings:health',
        async (event) => { validateSender(event); return getSettingsHealthSummary(); },
        { wrapResponse: true }
    ));

    safeHandle('settings:save', createValidatedIpcHandler<AppSettings, [AppSettings]>(
        'settings:save',
        async (event, settings) => {
            validateSender(event);
            return await handleSaveSettingsImplementation(settings);
        },
        {
            argsSchema: z.tuple([AppSettingsSchema]),
            wrapResponse: true,
            onError: (error) => {
                throw new TengraError(error.message, 'SETTINGS_SAVE_FAILED');
            },
            onValidationFailed: () => {
                settingsTelemetry.validationFailureCount += 1;
                settingsTelemetry.lastErrorCode = SETTINGS_ERROR_CODE.VALIDATION;
                trackSettingsEvent('settings.save.validation-failed', {
                    code: SETTINGS_ERROR_CODE.VALIDATION
                });
                appLogger.warn('SettingsIPC', 'Settings validation failed');
                throw new TengraError('Validation failed', 'SETTINGS_VALIDATION_ERROR');
            }
        }
    ));
}

