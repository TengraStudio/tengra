import { appLogger } from '@main/logging/logger';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { CopilotService } from '@main/services/llm/copilot.service';
import { LLMService } from '@main/services/llm/llm.service';
import { SettingsService } from '@main/services/system/settings.service';
import { registerBatchableHandler } from '@main/utils/ipc-batch.util';
import { createIpcHandler, createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { IpcValue } from '@shared/types/common';
import { AppSettings } from '@shared/types/settings';
import { app, ipcMain } from 'electron';
import { z } from 'zod';

// Define a rigorous schema for AppSettings to prevent injection or invalid state
const AppSettingsSchema = z.object({
    general: z.object({
        language: z.enum(['tr', 'en', 'de', 'fr', 'es', 'ja', 'zh', 'ar']).optional(),
    }).passthrough().optional(),
    openai: z.object({ apiKey: z.string().optional() }).passthrough().optional(),
    anthropic: z.object({ apiKey: z.string().optional() }).passthrough().optional(),
    groq: z.object({ apiKey: z.string().optional() }).passthrough().optional(),
    github: z.object({ token: z.string().optional() }).passthrough().optional(),
    // Allow other top-level keys loosely for now, but ensure they are objects or primitives
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
    settingsService: SettingsService
    llmService: LLMService
    copilotService: CopilotService
    auditLogService?: AuditLogService
    updateOpenAIConnection: () => void
    updateOllamaConnection: () => void | Promise<void>
}) {
    const { settingsService, llmService, copilotService, auditLogService, updateOpenAIConnection, updateOllamaConnection } = options;

    /**
     * Logs audit entries when sensitive settings fields (API keys) are modified.
     */
    async function auditSensitiveChanges(newSettings: AppSettings, oldSettings: AppSettings, auditService: AuditLogService | undefined) {
        if (!auditService) { return; }
        const sensitiveChanges: string[] = [];
        const fields = [
            { key: 'openai', label: 'OpenAI API key' },
            { key: 'anthropic', label: 'Anthropic API key' },
            { key: 'groq', label: 'Groq API key' },
            { key: 'proxy', label: 'Proxy key' }
        ] as const;

        for (const field of fields) {
            checkSensitiveField(field, newSettings, oldSettings, sensitiveChanges);
        }

        if (sensitiveChanges.length > 0) {
            await auditService.log({
                action: 'Settings updated',
                category: 'settings',
                success: true,
                details: { changes: sensitiveChanges, changedFields: Object.keys(newSettings) }
            });
        }
    }

    function checkSensitiveField(field: { key: 'openai' | 'anthropic' | 'groq' | 'proxy'; label: string }, newSettings: AppSettings, oldSettings: AppSettings, changes: string[]) {
        const newVal = (newSettings[field.key] as Record<string, unknown> | undefined)?.apiKey ?? (newSettings[field.key] as Record<string, unknown> | undefined)?.key;
        const oldVal = (oldSettings[field.key] as Record<string, unknown> | undefined)?.apiKey ?? (oldSettings[field.key] as Record<string, unknown> | undefined)?.key;

        if (typeof newVal === 'string' && newVal !== oldVal) {
            changes.push(`${field.label} updated`);
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
        const finalSettings = await settingsService.saveSettings(newSettings);
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
    }

    // Register batchable settings handlers
    registerBatchableHandler('getSettings', async (): Promise<IpcValue> => {
        return settingsService.getSettings();
    });

    // Validated batch handler
    const validatedSaveHandler = createValidatedIpcHandler(
        'saveSettings',
        async (_event, settings) => {
            await handleSaveSettingsImplementation(settings as AppSettings);
            return { success: true };
        },
        { argsSchema: z.tuple([AppSettingsSchema]) }
    );

    registerBatchableHandler('saveSettings', validatedSaveHandler);

    ipcMain.handle('settings:get', createIpcHandler('settings:get', async () => {
        return settingsService.getSettings();
    }));

    ipcMain.handle('settings:save', createValidatedIpcHandler(
        'settings:save',
        async (_event, settings) => {
            return await handleSaveSettingsImplementation(settings as AppSettings);
        },
        {
            argsSchema: z.tuple([AppSettingsSchema]),
            wrapResponse: true
        }
    ));
}
