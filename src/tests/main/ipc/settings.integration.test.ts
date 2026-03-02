import { registerSettingsIpc } from '@main/ipc/settings';
import { AppSettings } from '@shared/types/settings';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type IpcPayload = AppSettings | Partial<AppSettings> | object | string | number | boolean | null | undefined;
type IpcHandler = (event: IpcMainInvokeEvent, ...args: IpcPayload[]) => Promise<IpcPayload>;
type BatchHandler = (...args: IpcPayload[]) => Promise<IpcPayload>;
type WrappedResponse = {
    success: boolean;
    data?: AppSettings;
    error?: {
        message: string;
        code: string;
    };
};

const ipcHandlers = new Map<string, IpcHandler>();
const batchHandlers = new Map<string, BatchHandler>();
const mockEvent = { sender: { id: 1 } } as never as IpcMainInvokeEvent;

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: IpcHandler) => {
            ipcHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn()
    },
    app: {
        isPackaged: false,
        setLoginItemSettings: vi.fn()
    }
}));

vi.mock('@main/utils/ipc-batch.util', () => ({
    registerBatchableHandler: vi.fn((channel: string, handler: BatchHandler) => {
        batchHandlers.set(channel, handler);
    })
}));

describe('Settings IPC Handlers', () => {
    let settingsState: AppSettings;
    let settingsService: {
        getSettings: ReturnType<typeof vi.fn>;
        saveSettings: ReturnType<typeof vi.fn>;
    };
    let llmService: {
        setOpenAIApiKey: ReturnType<typeof vi.fn>;
        setAnthropicApiKey: ReturnType<typeof vi.fn>;
        setGroqApiKey: ReturnType<typeof vi.fn>;
    };
    let copilotService: {
        setCopilotToken: ReturnType<typeof vi.fn>;
        setGithubToken: ReturnType<typeof vi.fn>;
    };
    let updateOpenAIConnection: () => void;
    let updateOllamaConnection: () => Promise<void>;
    let updateOpenAIConnectionCallCount = 0;
    let updateOllamaConnectionCallCount = 0;

    const createSettingsState = (): AppSettings => ({
        ollama: { url: 'http://localhost:11434' },
        embeddings: { provider: 'none' },
        general: {
            language: 'en',
            theme: 'system',
            resolution: 'auto',
            fontSize: 14,
            onboardingCompleted: true
        }
    });

    beforeEach(() => {
        ipcHandlers.clear();
        batchHandlers.clear();
        vi.clearAllMocks();

        settingsState = createSettingsState();
        settingsService = {
            getSettings: vi.fn(() => settingsState),
            saveSettings: vi.fn(async (patch: Partial<AppSettings>) => {
                settingsState = { ...settingsState, ...patch };
                return settingsState;
            })
        };
        llmService = {
            setOpenAIApiKey: vi.fn(),
            setAnthropicApiKey: vi.fn(),
            setGroqApiKey: vi.fn()
        };
        copilotService = {
            setCopilotToken: vi.fn(),
            setGithubToken: vi.fn()
        };
        updateOpenAIConnectionCallCount = 0;
        updateOllamaConnectionCallCount = 0;
        updateOpenAIConnection = () => {
            updateOpenAIConnectionCallCount += 1;
        };
        updateOllamaConnection = async () => {
            updateOllamaConnectionCallCount += 1;
        };

        registerSettingsIpc({
            getMainWindow: () => null,
            settingsService: settingsService as never,
            llmService: llmService as never,
            copilotService: copilotService as never,
            updateOpenAIConnection,
            updateOllamaConnection
        });
    });

    it('registers settings and batch handlers', () => {
        expect(ipcMain.handle).toHaveBeenCalled();
        expect(ipcHandlers.has('settings:get')).toBe(true);
        expect(ipcHandlers.has('settings:save')).toBe(true);
        expect(ipcHandlers.has('settings:health')).toBe(true);
        expect(batchHandlers.has('getSettings')).toBe(true);
        expect(batchHandlers.has('saveSettings')).toBe(true);
    });

    it('returns settings from settings:get', async () => {
        const handler = ipcHandlers.get('settings:get')!;
        const result = await handler(mockEvent);
        expect(result).toEqual({ success: true, data: settingsState });
    });

    it('saves settings and wraps response', async () => {
        const handler = ipcHandlers.get('settings:save')!;
        const payload: Partial<AppSettings> = {
            general: { ...settingsState.general, language: 'fr' }
        };

        const result = await handler(mockEvent, payload) as WrappedResponse;
        expect(result.success).toBe(true);
        expect(settingsService.saveSettings).toHaveBeenCalledWith(payload);
        expect(updateOpenAIConnectionCallCount).toBe(1);
        expect(updateOllamaConnectionCallCount).toBe(1);
    });

    it('returns validation error code for invalid language', async () => {
        const handler = ipcHandlers.get('settings:save')!;
        const invalidPayload: IpcPayload = {
            general: { ...settingsState.general, language: 'xx' }
        };

        const result = await handler(mockEvent, invalidPayload) as WrappedResponse;
        expect(result).toMatchObject({
            success: false,
            error: {
                message: expect.any(String),
                code: 'SETTINGS_VALIDATION_ERROR'
            }
        });
    });

    it('returns standardized error when save fails', async () => {
        settingsService.saveSettings.mockRejectedValueOnce(new Error('disk write failed'));
        settingsService.saveSettings.mockRejectedValueOnce(new Error('disk write failed'));
        const handler = ipcHandlers.get('settings:save')!;
        const payload: Partial<AppSettings> = { general: settingsState.general };

        const result = await handler(mockEvent, payload) as WrappedResponse;
        expect(result).toMatchObject({
            success: false,
            error: {
                message: 'disk write failed',
                code: 'SETTINGS_SAVE_FAILED'
            }
        });
    });

    it('retries once before succeeding', async () => {
        settingsService.saveSettings
            .mockRejectedValueOnce(new Error('transient'))
            .mockResolvedValueOnce({
                ...settingsState,
                general: { ...settingsState.general, language: 'de' }
            });

        const handler = ipcHandlers.get('settings:save')!;
        const payload: Partial<AppSettings> = {
            general: { ...settingsState.general, language: 'de' }
        };
        const result = await handler(mockEvent, payload) as WrappedResponse;

        expect(result.success).toBe(true);
        expect(settingsService.saveSettings).toHaveBeenCalledTimes(2);
    });

    it('returns validation error for batch save handler', async () => {
        const batchHandler = batchHandlers.get('saveSettings')!;
        const result = await batchHandler(mockEvent as IpcPayload, {
            general: { ...settingsState.general, language: 'invalid' }
        });

        expect(result).toMatchObject({
            success: false,
            error: {
                message: expect.any(String),
                code: 'SETTINGS_VALIDATION_ERROR'
            }
        });
    });

    it('exposes settings telemetry and health summary', async () => {
        const getHandler = ipcHandlers.get('settings:get')!;
        const saveHandler = ipcHandlers.get('settings:save')!;
        const healthHandler = ipcHandlers.get('settings:health')!;
        const payload: Partial<AppSettings> = {
            general: { ...settingsState.general, language: 'de' }
        };

        await getHandler(mockEvent);
        await saveHandler(mockEvent, payload);

        const health = await healthHandler(mockEvent) as {
            success: boolean;
            data: {
                status: string;
                metrics: {
                    getCount: number;
                    saveCount: number;
                };
            };
        };

        expect(health.success).toBe(true);
        expect(health.data.metrics.getCount).toBeGreaterThanOrEqual(1);
        expect(health.data.metrics.saveCount).toBeGreaterThanOrEqual(1);
    });
});
