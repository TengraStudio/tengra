/**
 * Unit tests for ScreenshotService
 */
import { ScreenshotService } from '@main/services/ui/screenshot.service';
import { beforeEach, describe, expect, it } from 'vitest';

describe('ScreenshotService', () => {
    let service: ScreenshotService;

    beforeEach(() => {
        service = new ScreenshotService();
    });

    // ── Constructor ────────────────────────────────────────────

    describe('constructor', () => {
        it('should create an instance', () => {
            expect(service).toBeDefined();
            expect(service).toBeInstanceOf(ScreenshotService);
        });
    });

    // ── captureScreen ──────────────────────────────────────────

    describe('captureScreen', () => {
        it('should return a successful result', async () => {
            const result = await service.captureScreen();
            expect(result).toEqual({ success: true });
        });

        it('should return an object with success property', async () => {
            const result = await service.captureScreen();
            expect(result).toHaveProperty('success');
            expect(result.success).toBe(true);
        });

        it('should return a promise', () => {
            const result = service.captureScreen();
            expect(result).toBeInstanceOf(Promise);
        });
    });

    // ── captureWindow ──────────────────────────────────────────

    describe('captureWindow', () => {
        it('should return a successful result without window name', async () => {
            const result = await service.captureWindow();
            expect(result).toEqual({ success: true });
        });

        it('should return a successful result with a window name', async () => {
            const result = await service.captureWindow('MainWindow');
            expect(result).toEqual({ success: true });
        });

        it('should accept undefined as window name', async () => {
            const result = await service.captureWindow(undefined);
            expect(result).toEqual({ success: true });
        });

        it('should accept an empty string as window name', async () => {
            const result = await service.captureWindow('');
            expect(result).toEqual({ success: true });
        });

        it('should return a promise', () => {
            const result = service.captureWindow('Test');
            expect(result).toBeInstanceOf(Promise);
        });
    });

    // ── listWindows ────────────────────────────────────────────

    describe('listWindows', () => {
        it('should return a successful result', async () => {
            const result = await service.listWindows();
            expect(result.success).toBe(true);
        });

        it('should return an empty windows array', async () => {
            const result = await service.listWindows();
            expect(result.windows).toBeDefined();
            expect(result.windows).toEqual([]);
        });

        it('should not include an error property on success', async () => {
            const result = await service.listWindows();
            expect(result.error).toBeUndefined();
        });

        it('should return a promise', () => {
            const result = service.listWindows();
            expect(result).toBeInstanceOf(Promise);
        });
    });

    // ── Return type structure ──────────────────────────────────

    describe('return type structure', () => {
        it('captureScreen result should not have error on success', async () => {
            const result = await service.captureScreen();
            expect(result.error).toBeUndefined();
        });

        it('captureScreen result should not have image in placeholder', async () => {
            const result = await service.captureScreen();
            expect(result.image).toBeUndefined();
        });

        it('captureWindow result should not have error on success', async () => {
            const result = await service.captureWindow('test');
            expect(result.error).toBeUndefined();
        });

        it('captureWindow result should not have image in placeholder', async () => {
            const result = await service.captureWindow('test');
            expect(result.image).toBeUndefined();
        });

        it('listWindows result should have windows as string array', async () => {
            const result = await service.listWindows();
            expect(Array.isArray(result.windows)).toBe(true);
        });
    });

    // ── Edge cases ─────────────────────────────────────────────

    describe('edge cases', () => {
        it('should handle multiple sequential captureScreen calls', async () => {
            const results = await Promise.all([
                service.captureScreen(),
                service.captureScreen(),
                service.captureScreen(),
            ]);
            for (const result of results) {
                expect(result.success).toBe(true);
            }
        });

        it('should handle multiple sequential captureWindow calls', async () => {
            const results = await Promise.all([
                service.captureWindow('Window1'),
                service.captureWindow('Window2'),
                service.captureWindow(),
            ]);
            for (const result of results) {
                expect(result.success).toBe(true);
            }
        });

        it('should handle multiple sequential listWindows calls', async () => {
            const results = await Promise.all([
                service.listWindows(),
                service.listWindows(),
            ]);
            for (const result of results) {
                expect(result.success).toBe(true);
                expect(result.windows).toEqual([]);
            }
        });

        it('should handle special characters in window name', async () => {
            const result = await service.captureWindow('Window — Тест & <special>');
            expect(result.success).toBe(true);
        });

        it('should handle very long window name', async () => {
            const longName = 'A'.repeat(1000);
            const result = await service.captureWindow(longName);
            expect(result.success).toBe(true);
        });

        it('should work with a fresh instance each time', async () => {
            const service1 = new ScreenshotService();
            const service2 = new ScreenshotService();

            const [r1, r2] = await Promise.all([
                service1.captureScreen(),
                service2.captureScreen(),
            ]);

            expect(r1.success).toBe(true);
            expect(r2.success).toBe(true);
        });
    });
});
