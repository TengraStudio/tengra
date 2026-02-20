import { registerVoiceIpc } from '@main/ipc/voice';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ipcMainHandlers = new Map<string, (...args: any[]) => any>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel, handler) => {
            ipcMainHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn()
    }
}));

vi.mock('@main/utils/ipc-wrapper.util', () => ({
    createValidatedIpcHandler: (
        _name: string,
        handler: (...args: any[]) => any,
        options?: { argsSchema?: { parse: (args: unknown[]) => unknown[] }; defaultValue?: unknown }
    ) => async (event: unknown, ...args: unknown[]) => {
        try {
            const parsedArgs = options?.argsSchema ? options.argsSchema.parse(args) : args;
            const result = await handler(event, ...(parsedArgs as unknown[]));
            return { success: true, data: result };
        } catch (error: any) {
            if (options && Object.prototype.hasOwnProperty.call(options, 'defaultValue')) {
                return options.defaultValue;
            }
            return { success: false, error: error.message ?? 'Validation failed' };
        }
    }
}));

describe('Voice IPC Handlers', () => {
    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();
        registerVoiceIpc();
    });

    it('detects wake words and intents', async () => {
        const handler = ipcMainHandlers.get('voice:wake-word-detect');
        const result = await handler?.({}, {
            transcript: 'Hey Tandem open settings',
            wakeWord: 'hey tandem'
        });
        expect(result.success).toBe(true);
        expect(result.data.activated).toBe(true);
        expect(result.data.intent).toBe('open_settings');
    });

    it('handles voice session lifecycle', async () => {
        const startHandler = ipcMainHandlers.get('voice:session-start');
        const utteranceHandler = ipcMainHandlers.get('voice:session-utterance');
        const endHandler = ipcMainHandlers.get('voice:session-end');

        const started = await startHandler?.({}, { wakeWord: 'hey tandem', locale: 'en-US' });
        expect(started.success).toBe(true);
        const sessionId = started.data.id;

        const utterance = await utteranceHandler?.({}, {
            sessionId,
            transcript: 'hey tandem stop speaking',
            assistantSpeaking: true
        });
        expect(utterance.success).toBe(true);
        expect(utterance.data.interruptAssistant).toBe(true);
        expect(utterance.data.intent).toBe('stop_speaking');

        const ended = await endHandler?.({}, sessionId);
        expect(ended).toMatchObject({ success: true, data: { success: true } });
    });

    it('creates and searches voice notes', async () => {
        const createHandler = ipcMainHandlers.get('voice:note-create');
        const searchHandler = ipcMainHandlers.get('voice:note-search');
        const deleteHandler = ipcMainHandlers.get('voice:note-delete');

        const created = await createHandler?.({}, {
            title: 'Sprint notes',
            transcript: 'We should finalize release notes. Next step is running smoke tests.'
        });
        expect(created.success).toBe(true);
        expect(created.data.summary.length).toBeGreaterThan(0);
        expect(created.data.actionItems.length).toBeGreaterThan(0);

        const found = await searchHandler?.({}, { query: 'release' });
        expect(found.success).toBe(true);
        expect(found.data.notes.length).toBeGreaterThan(0);

        const deleted = await deleteHandler?.({}, created.data.id);
        expect(deleted.success).toBe(true);
        expect(deleted.data.deleted).toBe(true);
    });
});

