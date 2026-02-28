/**
 * Unit tests for NotificationService
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockShow = vi.fn();
let mockIsSupported = vi.fn().mockReturnValue(true);
const mockConstructorCalls: Array<{ title: string; body: string; silent: boolean }> = [];

class MockNotification {
    constructor(opts: { title: string; body: string; silent: boolean }) {
        mockConstructorCalls.push(opts);
    }
    show = mockShow;
    static isSupported = mockIsSupported;
}

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
    Notification: MockNotification,
}));

let NotificationService: typeof import('@main/services/ui/notification.service').NotificationService;

beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockConstructorCalls.length = 0;
    MockNotification.isSupported = vi.fn().mockReturnValue(true);
    mockIsSupported = MockNotification.isSupported;

    const mod = await import('@main/services/ui/notification.service');
    NotificationService = mod.NotificationService;
});

describe('NotificationService', () => {
    describe('constructor', () => {
        it('should create an instance', () => {
            const service = new NotificationService();
            expect(service).toBeDefined();
        });
    });

    describe('showNotification', () => {
        it('should create and show a notification when supported', () => {
            const service = new NotificationService();
            const result = service.showNotification('Test Title', 'Test Body');

            expect(mockConstructorCalls).toHaveLength(1);
            expect(mockConstructorCalls[0]).toEqual({
                title: 'Test Title',
                body: 'Test Body',
                silent: false,
            });
            expect(mockShow).toHaveBeenCalledOnce();
            expect(result).toEqual({ success: true });
        });

        it('should pass silent option when set to true', () => {
            const service = new NotificationService();
            service.showNotification('Title', 'Body', true);

            expect(mockConstructorCalls[0]).toEqual({
                title: 'Title',
                body: 'Body',
                silent: true,
            });
        });

        it('should default silent to false', () => {
            const service = new NotificationService();
            service.showNotification('Title', 'Body');

            expect(mockConstructorCalls[0]).toEqual(
                expect.objectContaining({ silent: false }),
            );
        });

        it('should return failure when notifications are not supported', () => {
            mockIsSupported.mockReturnValue(false);

            const service = new NotificationService();
            const result = service.showNotification('Title', 'Body');

            expect(result).toEqual({ success: false, error: 'Notifications not supported' });
            expect(mockConstructorCalls).toHaveLength(0);
            expect(mockShow).not.toHaveBeenCalled();
        });

        it('should handle empty title and body strings', () => {
            const service = new NotificationService();
            const result = service.showNotification('', '');

            expect(result).toEqual({ success: true });
            expect(mockConstructorCalls[0]).toEqual({
                title: '',
                body: '',
                silent: false,
            });
            expect(mockShow).toHaveBeenCalledOnce();
        });

        it('should handle long title and body text', () => {
            const longText = 'A'.repeat(1000);
            const service = new NotificationService();
            const result = service.showNotification(longText, longText);

            expect(result).toEqual({ success: true });
            expect(mockConstructorCalls[0]).toEqual({
                title: longText,
                body: longText,
                silent: false,
            });
        });

        it('should handle special characters in title and body', () => {
            const service = new NotificationService();
            const result = service.showNotification(
                'Title with <html> & "quotes"',
                'Body with\nnewlines\tand\ttabs',
            );

            expect(result).toEqual({ success: true });
            expect(mockConstructorCalls[0]).toEqual({
                title: 'Title with <html> & "quotes"',
                body: 'Body with\nnewlines\tand\ttabs',
                silent: false,
            });
        });

        it('should call show exactly once per invocation', () => {
            const service = new NotificationService();
            service.showNotification('T1', 'B1');
            service.showNotification('T2', 'B2');
            service.showNotification('T3', 'B3');

            expect(mockShow).toHaveBeenCalledTimes(3);
            expect(mockConstructorCalls).toHaveLength(3);
        });
    });

    describe('edge cases', () => {
        it('should handle unicode characters', () => {
            const service = new NotificationService();
            const result = service.showNotification('🔔 Bildirim', '日本語テスト');

            expect(result).toEqual({ success: true });
            expect(mockConstructorCalls[0]).toEqual({
                title: '🔔 Bildirim',
                body: '日本語テスト',
                silent: false,
            });
        });

        it('should not show notification when not supported even with silent true', () => {
            mockIsSupported.mockReturnValue(false);

            const service = new NotificationService();
            const result = service.showNotification('Title', 'Body', true);

            expect(result).toEqual({ success: false, error: 'Notifications not supported' });
            expect(mockShow).not.toHaveBeenCalled();
        });
    });
});
