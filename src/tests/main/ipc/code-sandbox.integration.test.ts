import { registerCodeSandboxIpc } from '@main/ipc/code-sandbox';
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

describe('Code Sandbox IPC Handlers', () => {
    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();
        registerCodeSandboxIpc();
    });

    it('lists supported sandbox languages', async () => {
        const handler = ipcMainHandlers.get('code-sandbox:languages');
        const result = await handler?.({});
        expect(result).toMatchObject({
            success: true,
            data: { languages: ['javascript', 'typescript', 'python', 'shell'] }
        });
    });

    it('executes safe javascript code', async () => {
        const handler = ipcMainHandlers.get('code-sandbox:execute');
        const result = await handler?.({}, {
            language: 'javascript',
            code: 'const x = 2 + 2; console.log(x); x;',
            timeoutMs: 1000
        });
        expect(result.success).toBe(true);
        expect(result.data.success).toBe(true);
        expect(result.data.stdout).toContain('4');
        expect(result.data.result).toBe('4');
    });

    it('blocks javascript process access attempts', async () => {
        const handler = ipcMainHandlers.get('code-sandbox:execute');
        const result = await handler?.({}, {
            language: 'javascript',
            code: 'process.env.PATH',
            timeoutMs: 1000
        });
        expect(result.success).toBe(true);
        expect(result.data.success).toBe(false);
        expect(result.data.stderr).toContain('Blocked by sandbox security policy');
    });
});

