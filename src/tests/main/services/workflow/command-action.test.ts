/**
 * Unit tests for CommandActionHandler (BACKLOG-0431)
 * Covers: command execution, validation, error handling
 */
import { ChildProcess,exec } from 'child_process';

import { CommandActionHandler } from '@main/services/workflow/actions/command.action';
import { JsonValue } from '@shared/types/common';
import { WorkflowAction } from '@shared/types/workflow.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock child_process.exec as a function that accepts a callback.
 * promisify(exec) at module scope will wrap this into a promise-based function.
 */
vi.mock('child_process', () => ({
    exec: vi.fn(),
}));

const createAction = (config: Record<string, JsonValue>): WorkflowAction => ({
    id: 'action-1',
    type: 'command',
    config,
});

describe('CommandActionHandler', () => {
    let handler: CommandActionHandler;

    beforeEach(() => {
        vi.clearAllMocks();
        handler = new CommandActionHandler();
    });

    it('has type "command"', () => {
        expect(handler.type).toBe('command');
    });

    describe('execute', () => {
        it('executes a command and returns stdout/stderr', async () => {
            vi.mocked(exec).mockImplementation((_cmd, callback) => {
                (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
                    null,
                    { stdout: 'hello world', stderr: '' }
                );
                return undefined as unknown as ChildProcess;
            });

            const result = await handler.execute(createAction({ command: 'echo hello world' }));
            expect(result).toEqual({ stdout: 'hello world', stderr: '' });
        });

        it('returns stderr when command produces stderr output', async () => {
            vi.mocked(exec).mockImplementation((_cmd, callback) => {
                (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
                    null,
                    { stdout: '', stderr: 'warning: something' }
                );
                return undefined as unknown as ChildProcess;
            });

            const result = await handler.execute(createAction({ command: 'ls /nonexistent' }));
            expect(result).toEqual({ stdout: '', stderr: 'warning: something' });
        });

        it('throws when command config is missing', async () => {
            await expect(handler.execute(createAction({}))).rejects.toThrow(
                'Command action requires a "command" string in config'
            );
        });

        it('throws when command config is not a string', async () => {
            await expect(handler.execute(createAction({ command: 123 }))).rejects.toThrow(
                'Command action requires a "command" string in config'
            );
        });

        it('throws when exec fails', async () => {
            vi.mocked(exec).mockImplementation((_cmd, callback) => {
                (callback as (err: Error) => void)(new Error('permission denied'));
                return undefined as unknown as ChildProcess;
            });

            await expect(
                handler.execute(createAction({ command: 'rm -rf /' }))
            ).rejects.toThrow('Command execution failed');
        });

        it('calls exec with the provided command string', async () => {
            vi.mocked(exec).mockImplementation((_cmd, callback) => {
                (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
                    null,
                    { stdout: '', stderr: '' }
                );
                return undefined as unknown as ChildProcess;
            });

            await handler.execute(createAction({ command: 'npm run build' }));
            expect(exec).toHaveBeenCalledWith('npm run build', expect.anything());
        });
    });
});
