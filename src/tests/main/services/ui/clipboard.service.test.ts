/**
 * Unit tests for ClipboardService
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockClipboard = {
    readText: vi.fn().mockReturnValue(''),
    writeText: vi.fn(),
    clear: vi.fn(),
    readImage: vi.fn().mockReturnValue({
        isEmpty: vi.fn().mockReturnValue(true),
        toDataURL: vi.fn().mockReturnValue(''),
    }),
    writeImage: vi.fn(),
};

const mockNativeImage = {
    createFromDataURL: vi.fn().mockReturnValue({ toPNG: vi.fn() }),
};

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => '/tmp'),
        isPackaged: false,
        getVersion: vi.fn(() => '0.0.0-test'),
        quit: vi.fn(),
        on: vi.fn(),
        whenReady: vi.fn().mockResolvedValue(undefined),
    },
    ipcMain: { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn() },
    clipboard: mockClipboard,
    nativeImage: mockNativeImage,
}));

let ClipboardService: typeof import('@main/services/ui/clipboard.service').ClipboardService;

beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('@main/services/ui/clipboard.service');
    ClipboardService = mod.ClipboardService;
});

afterEach(() => {
    vi.useRealTimers();
});

describe('ClipboardService', () => {
    describe('constructor', () => {
        it('should create an instance with service name', () => {
            const service = new ClipboardService();
            expect(service).toBeDefined();
        });
    });

    describe('initialize', () => {
        it('should start the clipboard watcher interval', async () => {
            const service = new ClipboardService();
            await service.initialize();
            mockClipboard.readText.mockReturnValue('watched text');
            vi.advanceTimersByTime(2000);
            expect(mockClipboard.readText).toHaveBeenCalled();
            await service.cleanup();
        });

        it('should detect new clipboard text and add to history', async () => {
            const service = new ClipboardService();
            await service.initialize();

            mockClipboard.readText.mockReturnValue('new clipboard text');
            vi.advanceTimersByTime(2000);

            const { history } = service.getHistory();
            expect(history).toContain('new clipboard text');
            await service.cleanup();
        });

        it('should not add duplicate consecutive text to history', async () => {
            const service = new ClipboardService();
            await service.initialize();

            mockClipboard.readText.mockReturnValue('same text');
            vi.advanceTimersByTime(2000);
            vi.advanceTimersByTime(2000);

            const { history } = service.getHistory();
            expect(history.filter(t => t === 'same text')).toHaveLength(1);
            await service.cleanup();
        });

        it('should detect changing clipboard text over multiple intervals', async () => {
            const service = new ClipboardService();
            await service.initialize();

            mockClipboard.readText.mockReturnValue('first');
            vi.advanceTimersByTime(2000);

            mockClipboard.readText.mockReturnValue('second');
            vi.advanceTimersByTime(2000);

            const { history } = service.getHistory();
            expect(history[0]).toBe('second');
            expect(history[1]).toBe('first');
            await service.cleanup();
        });
    });

    describe('cleanup', () => {
        it('should clear the watcher interval', async () => {
            const service = new ClipboardService();
            await service.initialize();
            await service.cleanup();

            mockClipboard.readText.mockReturnValue('after cleanup');
            vi.advanceTimersByTime(4000);

            const { history } = service.getHistory();
            expect(history).not.toContain('after cleanup');
        });

        it('should be safe to call cleanup without initialize', async () => {
            const service = new ClipboardService();
            await expect(service.cleanup()).resolves.toBeUndefined();
        });

        it('should be safe to call cleanup multiple times', async () => {
            const service = new ClipboardService();
            await service.initialize();
            await service.cleanup();
            await expect(service.cleanup()).resolves.toBeUndefined();
        });
    });

    describe('writeText', () => {
        it('should write text to clipboard and return success', () => {
            const service = new ClipboardService();
            const result = service.writeText('hello');
            expect(result).toEqual({ success: true });
            expect(mockClipboard.writeText).toHaveBeenCalledWith('hello');
        });

        it('should add written text to history', () => {
            const service = new ClipboardService();
            service.writeText('copied text');
            const { history } = service.getHistory();
            expect(history).toContain('copied text');
        });

        it('should move duplicate text to the front of history', () => {
            const service = new ClipboardService();
            service.writeText('first');
            service.writeText('second');
            service.writeText('first');

            const { history } = service.getHistory();
            expect(history[0]).toBe('first');
            expect(history[1]).toBe('second');
            expect(history).toHaveLength(2);
        });
    });

    describe('readText', () => {
        it('should read text from clipboard', () => {
            mockClipboard.readText.mockReturnValue('clipboard content');
            const service = new ClipboardService();
            const result = service.readText();
            expect(result).toEqual({ success: true, text: 'clipboard content' });
        });

        it('should return empty string when clipboard is empty', () => {
            mockClipboard.readText.mockReturnValue('');
            const service = new ClipboardService();
            const result = service.readText();
            expect(result).toEqual({ success: true, text: '' });
        });
    });

    describe('appendText', () => {
        it('should append text to existing clipboard content', () => {
            mockClipboard.readText.mockReturnValue('existing');
            const service = new ClipboardService();
            const result = service.appendText('appended');
            expect(result).toEqual({ success: true, text: 'existing\nappended' });
            expect(mockClipboard.writeText).toHaveBeenCalledWith('existing\nappended');
        });

        it('should add appended result to history', () => {
            mockClipboard.readText.mockReturnValue('base');
            const service = new ClipboardService();
            service.appendText('extra');
            const { history } = service.getHistory();
            expect(history).toContain('base\nextra');
        });
    });

    describe('getHistory', () => {
        it('should return empty history initially', () => {
            const service = new ClipboardService();
            const result = service.getHistory();
            expect(result).toEqual({ success: true, history: [] });
        });

        it('should return history in reverse chronological order', () => {
            const service = new ClipboardService();
            service.writeText('first');
            service.writeText('second');
            service.writeText('third');

            const { history } = service.getHistory();
            expect(history).toEqual(['third', 'second', 'first']);
        });

        it('should cap history at 50 entries', () => {
            const service = new ClipboardService();
            const maxHistory = 50;
            for (let i = 0; i < maxHistory + 10; i++) {
                service.writeText(`text-${i}`);
            }

            const { history } = service.getHistory();
            expect(history).toHaveLength(maxHistory);
            expect(history[0]).toBe(`text-${maxHistory + 9}`);
        });
    });

    describe('clear', () => {
        it('should clear the system clipboard', () => {
            const service = new ClipboardService();
            const result = service.clear();
            expect(result).toEqual({ success: true });
            expect(mockClipboard.clear).toHaveBeenCalled();
        });

        it('should clear the history', () => {
            const service = new ClipboardService();
            service.writeText('some text');
            service.clear();
            const { history } = service.getHistory();
            expect(history).toHaveLength(0);
        });

        it('should reset lastText tracking', async () => {
            const service = new ClipboardService();
            await service.initialize();

            service.writeText('tracked');
            service.clear();

            mockClipboard.readText.mockReturnValue('tracked');
            vi.advanceTimersByTime(2000);

            const { history } = service.getHistory();
            expect(history).toContain('tracked');
            await service.cleanup();
        });
    });

    describe('readImage', () => {
        it('should return error when clipboard has no image', () => {
            const emptyImg = { isEmpty: vi.fn().mockReturnValue(true), toDataURL: vi.fn() };
            mockClipboard.readImage.mockReturnValue(emptyImg);

            const service = new ClipboardService();
            const result = service.readImage();
            expect(result).toEqual({ success: false, error: 'Clipboard does not contain an image' });
        });

        it('should return dataUrl when clipboard has an image', () => {
            const img = {
                isEmpty: vi.fn().mockReturnValue(false),
                toDataURL: vi.fn().mockReturnValue('data:image/png;base64,abc123'),
            };
            mockClipboard.readImage.mockReturnValue(img);

            const service = new ClipboardService();
            const result = service.readImage();
            expect(result).toEqual({ success: true, dataUrl: 'data:image/png;base64,abc123' });
        });
    });

    describe('writeImage', () => {
        it('should write image to clipboard from dataUrl', () => {
            const fakeImg = { toPNG: vi.fn() };
            mockNativeImage.createFromDataURL.mockReturnValue(fakeImg);

            const service = new ClipboardService();
            const result = service.writeImage('data:image/png;base64,xyz');
            expect(result).toEqual({ success: true });
            expect(mockNativeImage.createFromDataURL).toHaveBeenCalledWith('data:image/png;base64,xyz');
            expect(mockClipboard.writeImage).toHaveBeenCalledWith(fakeImg);
        });
    });

    describe('edge cases', () => {
        it('should ignore empty text from watcher', async () => {
            const service = new ClipboardService();
            await service.initialize();

            mockClipboard.readText.mockReturnValue('');
            vi.advanceTimersByTime(2000);

            const { history } = service.getHistory();
            expect(history).toHaveLength(0);
            await service.cleanup();
        });

        it('should handle rapid consecutive writes', () => {
            const service = new ClipboardService();
            for (let i = 0; i < 5; i++) {
                service.writeText(`rapid-${i}`);
            }
            const { history } = service.getHistory();
            expect(history).toHaveLength(5);
            expect(history[0]).toBe('rapid-4');
        });

        it('should handle writing empty-like whitespace strings', () => {
            const service = new ClipboardService();
            service.writeText('   ');
            const { history } = service.getHistory();
            expect(history).toContain('   ');
        });

        it('should properly deduplicate in history when watcher finds already-written text', async () => {
            const service = new ClipboardService();
            service.writeText('manual write');
            await service.initialize();

            mockClipboard.readText.mockReturnValue('manual write');
            vi.advanceTimersByTime(2000);

            // Should not create a duplicate — lastText is already set
            const { history } = service.getHistory();
            expect(history.filter(t => t === 'manual write')).toHaveLength(1);
            await service.cleanup();
        });
    });
});
