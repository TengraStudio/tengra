import { registerVoiceIpc } from '@main/ipc/voice';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type IpcHandler = (...args: unknown[]) => unknown | Promise<unknown>;
const ipcMainHandlers = new Map<string, IpcHandler>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: IpcHandler) => {
            ipcMainHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn()
    }
}));

describe('Voice IPC Handlers', () => {
    beforeAll(() => {
        registerVoiceIpc();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('processes transcript and matches a built-in command', async () => {
        const handler = ipcMainHandlers.get('voice:process-transcript');
        expect(handler).toBeDefined();
        const result = await handler?.({}, 'tengra open settings');
        expect(result).toMatchObject({
            success: true,
            command: { id: 'nav-settings' },
        });
    });

    it('handles listening and speaking lifecycle', async () => {
        const setListeningHandler = ipcMainHandlers.get('voice:set-listening');
        const synthesizeHandler = ipcMainHandlers.get('voice:synthesize');
        const stopSpeakingHandler = ipcMainHandlers.get('voice:stop-speaking');

        expect(setListeningHandler).toBeDefined();
        expect(synthesizeHandler).toBeDefined();
        expect(stopSpeakingHandler).toBeDefined();

        const listeningStarted = await setListeningHandler?.({}, true);
        expect(listeningStarted).toMatchObject({ success: true });

        const speakingStarted = await synthesizeHandler?.({}, { text: 'hello world' });
        expect(speakingStarted).toMatchObject({ success: true });

        const speakingStopped = await stopSpeakingHandler?.({});
        expect(speakingStopped).toMatchObject({ success: true });

        const listeningStopped = await setListeningHandler?.({}, false);
        expect(listeningStopped).toMatchObject({ success: true });
    });

    it('creates, updates, and removes voice commands', async () => {
        const addHandler = ipcMainHandlers.get('voice:add-command');
        const updateHandler = ipcMainHandlers.get('voice:update-command');
        const removeHandler = ipcMainHandlers.get('voice:remove-command');
        const listHandler = ipcMainHandlers.get('voice:get-commands');

        expect(addHandler).toBeDefined();
        expect(updateHandler).toBeDefined();
        expect(removeHandler).toBeDefined();
        expect(listHandler).toBeDefined();

        const command = {
            id: 'custom-open-help',
            phrase: 'open help',
            aliases: ['show help'],
            action: { type: 'navigate', target: 'help' },
            category: 'custom',
            description: 'Open help panel',
            enabled: true,
        } as const;

        const created = await addHandler?.({}, command);
        expect(created).toMatchObject({ success: true, command: { id: 'custom-open-help' } });

        const updated = await updateHandler?.({}, {
            ...command,
            aliases: ['show help', 'help panel'],
        });
        expect(updated).toMatchObject({ success: true, command: { id: 'custom-open-help' } });

        const listed = await listHandler?.({});
        expect(listed).toMatchObject({ success: true });

        const removed = await removeHandler?.({}, 'custom-open-help');
        expect(removed).toMatchObject({ success: true });
    });

    it('returns validation metadata for invalid payloads', async () => {
        const processTranscriptHandler = ipcMainHandlers.get('voice:process-transcript');
        expect(processTranscriptHandler).toBeDefined();

        const invalid = await processTranscriptHandler?.({}, '');
        expect(invalid).toMatchObject({
            success: false,
            errorCode: 'VOICE_VALIDATION_ERROR',
            messageKey: 'errors.unexpected',
            uiState: 'failure'
        });
    });

    it('exposes voice health metrics dashboard endpoint', async () => {
        const healthHandler = ipcMainHandlers.get('voice:health');
        expect(healthHandler).toBeDefined();

        const health = await healthHandler?.({});
        expect(health).toMatchObject({
            success: true,
            data: {
                status: expect.any(String),
                budgets: {
                    fastMs: 40,
                    standardMs: 120,
                    heavyMs: 220
                },
                metrics: {
                    totalCalls: expect.any(Number),
                    totalFailures: expect.any(Number),
                    totalRetries: expect.any(Number)
                }
            }
        });
    });
});

