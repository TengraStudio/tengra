import { appLogger } from '@main/logging/logger';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { CopilotService } from '@main/services/llm/copilot.service';
import { LLMService } from '@main/services/llm/llm.service';
import { SettingsService } from '@main/services/system/settings.service';
import { registerBatchableHandler } from '@main/utils/ipc-batch.util';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { IpcValue } from '@shared/types/common';
import { AppSettings } from '@shared/types/settings';
import { app, ipcMain, IpcMainInvokeEvent } from 'electron';

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

    // Register batchable settings handlers
    registerBatchableHandler('getSettings', async (): Promise<IpcValue> => {
        return settingsService.getSettings();
    });

    registerBatchableHandler('saveSettings', async (_event, ...args): Promise<IpcValue> => {
        const settings = args[0] as AppSettings;
        await settingsService.saveSettings(settings);
        return { success: true };
    });

    ipcMain.handle('settings:get', createIpcHandler('settings:get', async () => {
        const settings = settingsService.getSettings();
        return settings;
    }));

    /**
     * Logs audit entries when sensitive settings fields (API keys) are modified.
     * @param newSettings - The updated application settings
     * @param oldSettings - The previous application settings
     * @param auditService - Optional audit log service for recording changes
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

    /**
     * Checks if a sensitive settings field has changed and records it.
     * @param field - The field descriptor with key and label
     * @param newSettings - The updated application settings
     * @param oldSettings - The previous application settings
     * @param changes - Array to push change descriptions into
     */
    function checkSensitiveField(field: { key: 'openai' | 'anthropic' | 'groq' | 'proxy'; label: string }, newSettings: AppSettings, oldSettings: AppSettings, changes: string[]) {
        const newVal = (newSettings[field.key] as Record<string, unknown> | undefined)?.apiKey ?? (newSettings[field.key] as Record<string, unknown> | undefined)?.key;
        const oldVal = (oldSettings[field.key] as Record<string, unknown> | undefined)?.apiKey ?? (oldSettings[field.key] as Record<string, unknown> | undefined)?.key;

        if (typeof newVal === 'string' && newVal !== oldVal) {
            changes.push(`${field.label} updated`);
        }
    }

    /**
     * Updates LLM and Copilot service credentials from the saved settings.
     * @param finalSettings - The final merged application settings
     * @param newSettings - The raw new settings from the renderer
     */
    function updateServices(finalSettings: AppSettings, newSettings: AppSettings) {
        updateLlmCredentials(finalSettings, newSettings);
        updateCopilotCredentials(finalSettings);
    }

    /**
     * Sets API keys on the LLM service from the provided settings.
     * @param finalSettings - The final merged settings containing API keys
     * @param newSettings - The raw new settings for Groq key updates
     */
    function updateLlmCredentials(finalSettings: AppSettings, newSettings: AppSettings) {
        if (finalSettings.openai?.apiKey) { llmService.setOpenAIApiKey(finalSettings.openai.apiKey); }
        if (finalSettings.anthropic?.apiKey) { llmService.setAnthropicApiKey(finalSettings.anthropic.apiKey); }
        if (newSettings.groq) { llmService.setGroqApiKey(newSettings.groq.apiKey); }
    }

    /**
     * Sets Copilot and GitHub tokens on the Copilot service.
     * @param finalSettings - The final merged settings containing tokens
     */
    function updateCopilotCredentials(finalSettings: AppSettings) {
        if (finalSettings.copilot?.token) { copilotService.setCopilotToken(finalSettings.copilot.token); }
        if (finalSettings.github?.token) { copilotService.setGithubToken(finalSettings.github.token); }
    }



    ipcMain.handle('settings:save', createIpcHandler('settings:save', async (_event: IpcMainInvokeEvent, newSettings: AppSettings) => {
        const oldSettings = settingsService.getSettings();
        // Await the save to get the final merged settings (with preserved secrets)
        const finalSettings = await settingsService.saveSettings(newSettings);
        syncStartupBehavior(finalSettings);

        // Audit log for sensitive settings changes
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
    }));
}
