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
        listDirectory: vi.fn(),
        fileExists: vi.fn(),
        getFileInfo: vi.fn(),
        createDirectory: vi.fn(),
        deleteFile: vi.fn(),
        copyFile: vi.fn(),
        moveFile: vi.fn()
    };

    const command = { executeCommand: vi.fn() };
    const localImage = { generateImage: vi.fn() };
    const web = { searchWeb: vi.fn() };
    const system = { getSystemInfo: vi.fn() };
    const eventBus = { emit: vi.fn() };
    const mcp = { dispatch: vi.fn() };

    const createExecutor = () => {
        const options = {
            fileSystem,
            eventBus,
            command,
            localImage,
            web,
            system,
            mcp
        } as never as ToolExecutorOptions;

        return new ToolExecutor(options);
    };

    beforeEach(() => {
        vi.clearAllMocks();
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
                _toolHint: expect.stringContaining('directory listing is complete'),
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
});
