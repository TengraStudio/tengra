/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ToolExecutor, ToolExecutorOptions } from '@main/tools/tool-executor';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('ToolExecutor', () => {
    const fileSystem = {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        applyEdits: vi.fn(),
        listDirectory: vi.fn(),
        fileExists: vi.fn(),
        searchFiles: vi.fn(),
        getFileInfo: vi.fn(),
        createDirectory: vi.fn(),
        deleteFile: vi.fn(),
        copyFile: vi.fn(),
        moveFile: vi.fn()
    };

    const command = { executeCommand: vi.fn() }, localImage = { generateImage: vi.fn() };
    const web = { searchWeb: vi.fn() }, system = { getSystemInfo: vi.fn() };
    const eventBus = { emit: vi.fn() }, mcp = { dispatch: vi.fn(), getToolDefinitions: vi.fn() };
    const terminal = {
        createSession: vi.fn(),
        write: vi.fn(),
        getActiveSessions: vi.fn(),
        getSessionBuffer: vi.fn(),
        getSessionAnalytics: vi.fn(),
        kill: vi.fn(),
    };

    const createExecutor = () => {
        const options = {
            fileSystem,
            eventBus,
            command,
            localImage,
            web,
            system,
            mcp,
            terminal
        } as never as ToolExecutorOptions;

        return new ToolExecutor(options);
    };

    beforeEach(() => {
        vi.clearAllMocks();
        terminal.createSession.mockResolvedValue(true);
        terminal.write.mockReturnValue(true);
        terminal.getActiveSessions.mockReturnValue(['agent-term-1']);
        terminal.getSessionBuffer.mockResolvedValue('');
        terminal.getSessionAnalytics.mockResolvedValue({
            sessionId: 'agent-term-1',
            bytes: 0,
            lineCount: 0,
            commandCount: 0,
            updatedAt: 0,
        });
        mcp.getToolDefinitions.mockResolvedValue([]);
    });

    it('routes list_directory to fileSystem.listDirectory', async () => {
        fileSystem.listDirectory.mockResolvedValueOnce({
            success: true,
            data: [{ name: 'src', isDirectory: true }]
        });

        const executor = createExecutor();
        const result = await executor.execute('list_directory', { path: 'C:/repo' });

        expect(result).toEqual({
            success: true,
            result: {
                path: 'C:/repo',
                complete: true,
                pathExists: true,
                entryCount: 1,
                fileCount: 0,
                directoryCount: 1,
                entries: [{ name: 'src', isDirectory: true }],
            }
        });
        expect(fileSystem.listDirectory).toHaveBeenCalledWith('C:/repo');
    });

    it('routes file_exists to fileSystem.fileExists', async () => {
        fileSystem.fileExists.mockResolvedValueOnce({ exists: true });

        const executor = createExecutor();
        const result = await executor.execute('file_exists', { path: 'C:/repo/package.json' });

        expect(result).toEqual({ success: true, result: true });
        expect(fileSystem.fileExists).toHaveBeenCalledWith('C:/repo/package.json');
    });

    it('resolves relative paths against a base path and reports parent existence', async () => {
        fileSystem.fileExists
            .mockResolvedValueOnce({ exists: false })
            .mockResolvedValueOnce({ exists: true });

        const executor = createExecutor();
        const result = await executor.execute('resolve_path', {
            path: 'app/page.tsx',
            basePath: 'C:/repo'
        });

        expect(result).toEqual({
            success: true,
            result: {
                success: true,
                resultKind: 'path_resolution',
                inputPath: 'app/page.tsx',
                basePath: 'C:/repo',
                path: 'C:\\repo\\app\\page.tsx',
                parentPath: 'C:\\repo\\app',
                pathExists: false,
                parentExists: true,
                complete: true,
                displaySummary: 'Resolved path: C:\\repo\\app\\page.tsx',
            },
        });
    });

    it('returns structured evidence when creating a directory', async () => {
        fileSystem.fileExists.mockResolvedValueOnce({ exists: true });
        fileSystem.createDirectory.mockResolvedValueOnce({ success: true });

        const executor = createExecutor();
        const result = await executor.execute('create_directory', { path: 'C:/repo/app' });

        expect(result).toEqual({
            success: true,
            result: {
                success: true,
                resultKind: 'directory_create',
                path: 'C:\\repo\\app',
                inputPath: 'C:/repo/app',
                pathExists: true,
                existedBefore: true,
                created: false,
                complete: true,
                displaySummary: 'Directory already existed: C:\\repo\\app',
            },
        });
        expect(fileSystem.fileExists).toHaveBeenCalledWith('C:\\repo\\app');
        expect(fileSystem.createDirectory).toHaveBeenCalledWith('C:\\repo\\app');
    });

    it('rejects create_directory calls with an empty path before touching the file system', async () => {
        const executor = createExecutor();
        const result = await executor.execute('create_directory', { path: '' });
        expect(result.success).toBe(false);
        expect(result.error).toBe("Missing non-empty 'path' argument");
        expect(result.result).toEqual(expect.objectContaining({ resultKind: 'directory_create', retrySameCall: false }));
        expect(fileSystem.fileExists).not.toHaveBeenCalled();
        expect(fileSystem.createDirectory).not.toHaveBeenCalled();
    });

    it('returns structured evidence when writing a file', async () => {
        fileSystem.writeFile.mockResolvedValueOnce({ success: true });

        const executor = createExecutor();
        const result = await executor.execute('write_file', { path: 'C:/repo/app/page.tsx', content: 'export default function Page() { return null; }' });

        expect(result).toEqual({
            success: true,
            result: {
                success: true,
                resultKind: 'file_write',
                path: 'C:/repo/app/page.tsx',
                bytesWritten: 47,
                complete: true,
                displaySummary: 'Wrote 47 bytes to C:/repo/app/page.tsx',
            },
        });
        expect(fileSystem.writeFile).toHaveBeenCalledWith('C:/repo/app/page.tsx', 'export default function Page() { return null; }');
    });

    it('writes multiple files in one bounded tool call', async () => {
        fileSystem.writeFile
            .mockResolvedValueOnce({ success: true })
            .mockResolvedValueOnce({ success: true });

        const executor = createExecutor();
        const result = await executor.execute('write_files', {
            files: [
                { path: 'C:/repo/package.json', content: '{}' },
                { path: 'C:/repo/app/page.tsx', content: 'export default function Page() { return null; }' },
            ]
        });

        expect(result).toEqual({
            success: true,
            result: {
                success: true,
                resultKind: 'multi_file_write',
                complete: true,
                requestedCount: 2,
                writtenCount: 2,
                failedCount: 0,
                bytesWritten: 49,
                files: [
                    { success: true, path: 'C:/repo/package.json', bytesWritten: 2, error: null },
                    { success: true, path: 'C:/repo/app/page.tsx', bytesWritten: 47, error: null },
                ],
                displaySummary: 'Wrote 2 files (49 bytes)',
            },
            error: undefined,
        });
        expect(fileSystem.writeFile).toHaveBeenNthCalledWith(1, 'C:/repo/package.json', '{}');
        expect(fileSystem.writeFile).toHaveBeenNthCalledWith(2, 'C:/repo/app/page.tsx', 'export default function Page() { return null; }');
    });

    it('reads multiple files in one bounded tool call', async () => {
        fileSystem.readFile
            .mockResolvedValueOnce({ success: true, data: 'one' })
            .mockResolvedValueOnce({ success: true, data: 'two' });

        const executor = createExecutor();
        const result = await executor.execute('read_many_files', { paths: ['C:/repo/a.ts', 'C:/repo/b.ts'] });

        expect(result).toEqual({
            success: true,
            result: {
                success: true,
                resultKind: 'multi_file_read',
                complete: true,
                requestedCount: 2,
                readCount: 2,
                failedCount: 0,
                files: [
                    { path: 'C:/repo/a.ts', success: true, content: 'one', error: null },
                    { path: 'C:/repo/b.ts', success: true, content: 'two', error: null },
                ],
                displaySummary: 'Read 2 files',
            },
            error: undefined,
        });
    });

    it('applies line-based patches through FileSystemService', async () => {
        fileSystem.applyEdits.mockResolvedValueOnce({ success: true });

        const executor = createExecutor();
        const result = await executor.execute('patch_file', {
            path: 'C:/repo/app/page.tsx',
            edits: [{ startLine: 1, endLine: 1, replacement: 'export default function Page() { return <main />; }' }],
        });

        expect(result).toEqual({
            success: true,
            result: {
                success: true,
                resultKind: 'file_patch',
                path: 'C:/repo/app/page.tsx',
                editCount: 1,
                complete: true,
                displaySummary: 'Applied 1 line edit(s) to C:/repo/app/page.tsx',
            },
        });
        expect(fileSystem.applyEdits).toHaveBeenCalledWith(
            'C:/repo/app/page.tsx',
            [{ startLine: 1, endLine: 1, replacement: 'export default function Page() { return <main />; }' }]
        );
    });

    it('searches files through FileSystemService with result limiting', async () => {
        fileSystem.searchFiles.mockResolvedValueOnce({
            success: true,
            data: ['C:/repo/a.test.ts', 'C:/repo/b.test.ts', 'C:/repo/c.test.ts']
        });

        const executor = createExecutor();
        const result = await executor.execute('search_files', {
            rootPath: 'C:/repo',
            pattern: '.test.ts',
            maxResults: 2,
        });

        expect(result).toEqual({
            success: true,
            result: {
                success: true,
                resultKind: 'file_search',
                rootPath: 'C:/repo',
                pattern: '.test.ts',
                resultCount: 2,
                truncated: true,
                results: ['C:/repo/a.test.ts', 'C:/repo/b.test.ts'],
                complete: true,
                displaySummary: "Found 2 of 3 file(s) matching '.test.ts'",
            },
        });
        expect(fileSystem.searchFiles).toHaveBeenCalledWith('C:/repo', '.test.ts', 2);
    });

    it('routes get_file_info to fileSystem.getFileInfo', async () => {
        fileSystem.getFileInfo.mockResolvedValueOnce({
            success: true,
            data: { path: 'C:/repo/package.json', size: 123, isFile: true, isDirectory: false }
        });

        const executor = createExecutor();
        const result = await executor.execute('get_file_info', { path: 'C:/repo/package.json' });

        expect(result.success).toBe(true);
        expect(result.result).toEqual({ path: 'C:/repo/package.json', size: 123, isFile: true, isDirectory: false });
        expect(fileSystem.getFileInfo).toHaveBeenCalledWith('C:/repo/package.json');
    });

    it('routes get_system_info to SystemService', async () => {
        system.getSystemInfo.mockResolvedValueOnce({ platform: 'win32', hostname: 'dev-box' });

        const executor = createExecutor();
        const result = await executor.execute('get_system_info', {});

        expect(result).toEqual({
            success: true,
            result: { platform: 'win32', hostname: 'dev-box' }
        });
        expect(system.getSystemInfo).toHaveBeenCalledTimes(1);
    });

    it('falls back to MCP for unknown tools', async () => {
        mcp.dispatch.mockResolvedValueOnce({ success: true, data: { ok: true } });

        const executor = createExecutor();
        const result = await executor.execute('my_custom_tool', { value: 1 });

        expect(result).toEqual({
            success: true,
            result: { ok: true },
            error: undefined
        });
        expect(mcp.dispatch).toHaveBeenCalledWith('default', 'my_custom_tool', { value: 1 });
    });

    it('dispatches generated MCP tool names to the encoded service and action', async () => {
        mcp.dispatch.mockResolvedValueOnce({ success: true, data: { ok: true } });

        const executor = createExecutor();
        const result = await executor.execute('mcp__weather__forecast', { location: 'Istanbul' });

        expect(result).toEqual({
            success: true,
            result: { ok: true },
            error: undefined
        });
        expect(mcp.dispatch).toHaveBeenCalledWith('weather', 'forecast', { location: 'Istanbul' });
    });

    it('routes generate_image to LocalImageService with bounded count', async () => {
        localImage.generateImage
            .mockResolvedValueOnce('safe-file://image-1.png')
            .mockResolvedValueOnce('safe-file://image-2.png');

        const executor = createExecutor();
        const result = await executor.execute('generate_image', { prompt: 'Draw a cat', count: 2 });

        expect(result).toEqual({
            success: true,
            result: { images: ['safe-file://image-1.png', 'safe-file://image-2.png'] },
        });
        expect(localImage.generateImage).toHaveBeenCalledTimes(2);
        expect(localImage.generateImage).toHaveBeenNthCalledWith(1, { prompt: 'Draw a cat' });
        expect(localImage.generateImage).toHaveBeenNthCalledWith(2, { prompt: 'Draw a cat' });
    });

    it('uses the longer default timeout for generate_image', async () => {
        vi.useFakeTimers();
        localImage.generateImage.mockImplementation(
            () => new Promise(resolve => setTimeout(() => resolve('safe-file://image-1.png'), 35_000))
        );

        const executor = createExecutor();
        const pendingResult = executor.execute('generate_image', { prompt: 'Draw a cat' });

        await vi.advanceTimersByTimeAsync(35_000);
        const result = await pendingResult;

        expect(result).toEqual({
            success: true,
            result: { images: ['safe-file://image-1.png'] },
        });

        vi.useRealTimers();
    });

    it('keeps execute_command alive beyond 30 seconds and forwards extended timeout', async () => {
        vi.useFakeTimers();
        command.executeCommand.mockImplementationOnce(
            () => new Promise(resolve => setTimeout(() => resolve({ success: true, stdout: 'ok' }), 35_000))
        );

        const executor = createExecutor();
        const pendingResult = executor.execute('execute_command', { command: 'echo ok' });

        await vi.advanceTimersByTimeAsync(35_000);
        const result = await pendingResult;

        expect(result).toEqual({
            success: true,
            result: {
                success: true,
                resultKind: 'command_execution',
                command: 'echo ok',
                cwd: null,
                stdout: 'ok',
                stderr: '',
                exitCode: null,
                complete: true,
                displaySummary: 'Command completed with exit code 0',
            },
            error: undefined,
        });
        expect(command.executeCommand).toHaveBeenCalledWith('echo ok', { cwd: undefined, timeout: 179000 });

        vi.useRealTimers();
    });

    it('passes context timeout to execute_command with safety margin', async () => {
        command.executeCommand.mockResolvedValueOnce({ success: true, stdout: 'done' });

        const executor = createExecutor();
        await executor.execute('execute_command', { command: 'echo done', cwd: 'C:/repo' }, { timeoutMs: 45000 });

        expect(command.executeCommand).toHaveBeenCalledWith('echo done', { cwd: 'C:/repo', timeout: 44000 });
    });

    it('returns structured stderr/exitCode payload on execute_command failure', async () => {
        command.executeCommand.mockResolvedValueOnce({
            success: false,
            stdout: 'partial-output',
            stderr: 'Access denied',
            exitCode: 1,
            error: 'Access denied',
        });

        const executor = createExecutor();
        const result = await executor.execute('execute_command', { command: 'Get-Item C:/restricted' });

        expect(result).toEqual({
            success: false,
            result: {
                success: false,
                resultKind: 'command_execution',
                command: 'Get-Item C:/restricted',
                cwd: null,
                stdout: 'partial-output',
                stderr: 'Access denied',
                exitCode: 1,
                complete: false,
                displaySummary: 'Command failed: Access denied',
            },
            error: 'Access denied',
            errorType: 'permission',
        });
    });

    it('starts a persistent agent terminal session', async () => {
        const executor = createExecutor();
        const result = await executor.execute('terminal_session_start', {
            sessionId: 'agent-term-1',
            cwd: 'C:/repo',
            title: 'Agent work',
        }, { workspaceId: 'workspace-1' });

        expect(result).toEqual({
            success: true,
            result: {
                success: true,
                resultKind: 'terminal_session',
                sessionId: 'agent-term-1',
                cwd: 'C:/repo',
                shell: null,
                title: 'Agent work',
                cols: 120,
                rows: 30,
                complete: true,
                displaySummary: 'Started terminal session agent-term-1',
            },
        });
        expect(terminal.createSession).toHaveBeenCalledWith(expect.objectContaining({
            id: 'agent-term-1',
            cwd: 'C:/repo',
            title: 'Agent work',
            workspaceId: 'workspace-1',
            metadata: { owner: 'agent', toolManaged: true },
        }));
    });

    it('writes validated commands to a persistent terminal session', async () => {
        const executor = createExecutor();
        const result = await executor.execute('terminal_session_write', {
            sessionId: 'agent-term-1',
            input: 'npm test',
        });

        expect(result).toEqual({
            success: true,
            result: {
                success: true,
                resultKind: 'terminal_write',
                sessionId: 'agent-term-1',
                inputKind: 'command',
                submitted: true,
                bytesWritten: 9,
                complete: true,
                displaySummary: 'Wrote command input to terminal session agent-term-1',
            },
        });
        expect(terminal.write).toHaveBeenCalledWith('agent-term-1', "npm test\r");
    });

    it('blocks dangerous terminal command writes', async () => {
        const executor = createExecutor();
        const result = await executor.execute('terminal_session_write', {
            sessionId: 'agent-term-1',
            input: 'rm -rf /',
        });

        expect(result.success).toBe(false);
        expect(result.errorType).toBe('permission');
        expect(terminal.write).not.toHaveBeenCalled();
    });

    it('reads terminal session output tails', async () => {
        terminal.getSessionBuffer.mockResolvedValueOnce('0123456789');

        const executor = createExecutor();
        const result = await executor.execute('terminal_session_read', {
            sessionId: 'agent-term-1',
            tailBytes: 4,
        });

        expect(result).toEqual({
            success: true,
            result: {
                success: true,
                resultKind: 'terminal_read',
                sessionId: 'agent-term-1',
                output: '6789',
                totalBytes: 10,
                truncated: true,
                complete: true,
                displaySummary: 'Read terminal session agent-term-1',
            },
        });
    });

    it('waits until terminal output matches a requested pattern', async () => {
        vi.useFakeTimers();
        terminal.getSessionBuffer
            .mockResolvedValueOnce('starting')
            .mockResolvedValueOnce('starting')
            .mockResolvedValueOnce('ready on http://localhost:3000');

        const executor = createExecutor();
        const pendingResult = executor.execute('terminal_session_wait', {
            sessionId: 'agent-term-1',
            pattern: 'localhost:3000',
            timeoutMs: 5000,
        });

        await vi.advanceTimersByTimeAsync(500);
        const result = await pendingResult;

        expect(result.success).toBe(true);
        expect(result.result).toMatchObject({
            resultKind: 'terminal_wait',
            sessionId: 'agent-term-1',
            matched: true,
            idle: false,
            timedOut: false,
            complete: true,
        });

        vi.useRealTimers();
    });
});
