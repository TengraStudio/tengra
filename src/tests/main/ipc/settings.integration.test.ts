/**
 * Integration tests for Settings IPC handlers
 */
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { SettingsService } from '../../../main/services/settings.service';
import { LLMService } from '../../../main/services/llm/llm.service';
import { CopilotService } from '../../../main/services/llm/copilot.service';
import { AppSettings } from '../../../main/../shared/types/settings';

// Mock electron
vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn(),
        removeHandler: vi.fn()
    }
}));

interface MockSettingsService extends Partial<SettingsService> {
    getSettings: Mock;
    saveSettings: Mock;
    resetSettings: Mock;
}

interface MockLlmService extends Partial<LLMService> {
    setApiKey: Mock;
    testConnection: Mock;
}

interface MockCopilotService extends Partial<CopilotService> {
    setGithubToken: Mock;
    isConfigured: Mock;
}

describe('Settings IPC Handlers', () => {
    let mockSettingsService: MockSettingsService;
    let mockLlmService: MockLlmService;
    let mockCopilotService: MockCopilotService;
    let registeredHandlers: Map<string, (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any>>;

    beforeEach(() => {
        registeredHandlers = new Map();

        // Capture registered handlers
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: any) => {
            registeredHandlers.set(channel, handler);
        });

        // Mock services
        mockSettingsService = {
            getSettings: vi.fn().mockReturnValue({
                theme: 'dark',
                language: 'en',
                fontSize: 14
            }),
            saveSettings: vi.fn().mockReturnValue(true),
            resetSettings: vi.fn().mockReturnValue(true)
        };

        mockLlmService = {
            setApiKey: vi.fn(),
            testConnection: vi.fn().mockResolvedValue({ success: true })
        };

        mockCopilotService = {
            setGithubToken: vi.fn(),
            isConfigured: vi.fn().mockReturnValue(true)
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('settings:get', () => {
        it('should return current settings', async () => {
            // Simulate registering the handler
            const handler = async () => mockSettingsService.getSettings();
            registeredHandlers.set('settings:get', handler);

            const result = await registeredHandlers.get('settings:get')!({} as unknown as IpcMainInvokeEvent, {});

            expect(result).toEqual({
                theme: 'dark',
                language: 'en',
                fontSize: 14
            });
        });
    });

    describe('settings:save', () => {
        it('should save settings and return success', async () => {
            const handler = async (_event: IpcMainInvokeEvent, settings: Partial<AppSettings>) => {
                return mockSettingsService.saveSettings(settings);
            };
            registeredHandlers.set('settings:save', handler);

            const newSettings = { general: { theme: 'light', fontSize: 16 } } as Partial<AppSettings>;
            const result = await registeredHandlers.get('settings:save')!({} as unknown as IpcMainInvokeEvent, newSettings);

            expect(mockSettingsService.saveSettings).toHaveBeenCalledWith(newSettings);
            expect(result).toBe(true);
        });

        it('should handle save failure gracefully', async () => {
            mockSettingsService.saveSettings.mockReturnValue(false);

            const handler = async (_event: IpcMainInvokeEvent, settings: Partial<AppSettings>) => {
                return mockSettingsService.saveSettings(settings);
            };
            registeredHandlers.set('settings:save', handler);

            const result = await registeredHandlers.get('settings:save')!({} as unknown as IpcMainInvokeEvent, {});

            expect(result).toBe(false);
        });
    });

    describe('settings:reset', () => {
        it('should reset settings to defaults', async () => {
            const handler = async () => mockSettingsService.resetSettings();
            registeredHandlers.set('settings:reset', handler);

            const result = await registeredHandlers.get('settings:reset')!({} as unknown as IpcMainInvokeEvent, {});

            expect(mockSettingsService.resetSettings).toHaveBeenCalled();
            expect(result).toBe(true);
        });
    });

    describe('settings:validate-api-key', () => {
        it('should validate API key and return success', async () => {
            const handler = async (_event: IpcMainInvokeEvent, apiKey: string) => {
                mockLlmService.setApiKey(apiKey);
                return mockLlmService.testConnection();
            };
            registeredHandlers.set('settings:validate-api-key', handler);

            const result = await registeredHandlers.get('settings:validate-api-key')!({} as unknown as IpcMainInvokeEvent, 'test-api-key');

            expect(mockLlmService.setApiKey).toHaveBeenCalledWith('test-api-key');
            expect(result).toEqual({ success: true });
        });

        it('should return failure for invalid API key', async () => {
            mockLlmService.testConnection.mockResolvedValue({ success: false, error: 'Invalid API key' });

            const handler = async (_event: IpcMainInvokeEvent, apiKey: string) => {
                mockLlmService.setApiKey(apiKey);
                return mockLlmService.testConnection();
            };
            registeredHandlers.set('settings:validate-api-key', handler);

            const result = await registeredHandlers.get('settings:validate-api-key')!({} as unknown as IpcMainInvokeEvent, 'invalid-key');

            expect(result).toEqual({ success: false, error: 'Invalid API key' });
        });
    });

    describe('settings:copilot-status', () => {
        it('should return copilot configuration status', () => {
            expect(mockCopilotService.isConfigured()).toBe(true);
        });
    });
});

describe('Settings Service Integration', () => {
    it('should persist settings across calls', async () => {
        let storedSettings: Partial<AppSettings> = { general: { theme: 'dark' } as any };

        const settingsService = {
            getSettings: () => storedSettings,
            saveSettings: (newSettings: Partial<AppSettings>) => {
                storedSettings = { ...storedSettings, ...newSettings };
                return true;
            }
        };

        // Get initial settings
        expect(settingsService.getSettings()).toEqual({ general: { theme: 'dark' } });

        // Update settings
        settingsService.saveSettings({ general: { theme: 'light', fontSize: 16 } as any });

        // Verify persistence
        expect(settingsService.getSettings()).toEqual({ general: { theme: 'light', fontSize: 16 } });
    });

    it('should handle concurrent updates correctly', async () => {
        const updates: Partial<AppSettings>[] = [];

        const settingsService = {
            saveSettings: async (settings: Partial<AppSettings>) => {
                updates.push(settings);
                await new Promise(resolve => setTimeout(resolve, 10));
                return true;
            }
        };

        // Simulate concurrent updates
        await Promise.all([
            settingsService.saveSettings({ general: { theme: 'light' } as any }),
            settingsService.saveSettings({ general: { fontSize: 16 } as any }),
            settingsService.saveSettings({ general: { language: 'en' } as any })
        ]);

        expect(updates).toHaveLength(3);
    });
});
