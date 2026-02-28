/**
 * Telemetry & health tests for ThemeService.
 * Extracted from theme.service.test.ts to stay within 500-line budget.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

const mockAccess = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockRename = vi.fn();

vi.mock('fs', () => ({
    promises: {
        access: mockAccess,
        readFile: mockReadFile,
        writeFile: mockWriteFile,
        rename: mockRename,
    },
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

/** Reset fs mocks to default success behaviour */
function resetFsMocks(): void {
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    mockReadFile.mockResolvedValue('{}');
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
}

/** Helper to create minimal valid custom theme input */
function validCustomThemeInput() {
    return {
        name: 'Telemetry Test',
        category: 'artisanal' as const,
        isDark: true,
        colors: {
            background: '0 0% 0%', foreground: '0 0% 100%',
            card: '', cardForeground: '', popover: '', popoverForeground: '',
            primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
            muted: '', mutedForeground: '', accent: '', accentForeground: '',
            destructive: '', destructiveForeground: '', border: 'b', input: 'i', ring: 'r',
        },
        isCustom: true as const,
        source: 'user-created' as const,
    };
}

// ── Telemetry Events & Health Tracking ──────────────────────────────

describe('ThemeService Telemetry & Health', () => {
    let service: InstanceType<typeof import('@main/services/ui/theme.service').ThemeService>;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        resetFsMocks();

        const mod = await import('@main/services/ui/theme.service');
        service = new mod.ThemeService();
        await service.initialize();
    });

    // ── getHealth ────────────────────────────────────────────────────

    describe('getHealth', () => {
        it('should return correct health snapshot after initialization', () => {
            const health = service.getHealth();
            expect(health.initialized).toBe(true);
            expect(health.currentTheme).toBe('graphite');
            expect(health.customThemeCount).toBe(0);
            expect(health.favoriteCount).toBe(0);
            expect(health.historySize).toBe(1);
            expect(health.hasActivePreset).toBe(false);
            expect(typeof health.storePath).toBe('string');
        });

        it('should reflect custom theme count after adding themes', async () => {
            await service.addCustomTheme(validCustomThemeInput());
            expect(service.getHealth().customThemeCount).toBe(1);
        });

        it('should reflect active preset', async () => {
            await service.applyPreset('developer');
            expect(service.getHealth().hasActivePreset).toBe(true);
        });

        it('should reflect favorite count', async () => {
            await service.toggleFavorite('obsidian');
            expect(service.getHealth().favoriteCount).toBe(1);
        });
    });

    // ── getHealth before initialization ──────────────────────────────

    describe('getHealth before initialization', () => {
        it('should return initialized: false before initialize()', async () => {
            vi.resetModules();
            vi.clearAllMocks();
            resetFsMocks();
            const mod = await import('@main/services/ui/theme.service');
            const uninitService = new mod.ThemeService();
            expect(uninitService.getHealth().initialized).toBe(false);
        });
    });

    // ── Telemetry on theme switch ────────────────────────────────────

    describe('telemetry on setTheme', () => {
        it('should emit theme.switch event on successful switch', async () => {
            await service.setTheme('obsidian');
            const events = service.getTelemetryLog();
            const ev = events.find(e => e.action === 'theme.switch' && e.success);
            expect(ev).toBeDefined();
            expect(ev!.themeId).toBe('obsidian');
            expect(ev!.previousThemeId).toBe('graphite');
            expect(typeof ev!.durationMs).toBe('number');
        });

        it('should emit failure event for invalid theme', async () => {
            await service.setTheme('nonexistent');
            const ev = service.getTelemetryLog().find(e => e.action === 'theme.switch' && !e.success);
            expect(ev).toBeDefined();
            expect(ev!.themeId).toBe('nonexistent');
        });
    });

    // ── Telemetry on custom theme CRUD ───────────────────────────────

    describe('telemetry on addCustomTheme', () => {
        it('should emit theme.custom.create event', async () => {
            const theme = await service.addCustomTheme(validCustomThemeInput());
            expect(theme).not.toBeNull();
            const ev = service.getTelemetryLog().find(e => e.action === 'theme.custom.create' && e.success);
            expect(ev).toBeDefined();
            expect(ev!.themeId).toBe(theme!.id);
        });
    });

    describe('telemetry on deleteCustomTheme', () => {
        it('should emit success event on delete', async () => {
            const theme = await service.addCustomTheme(validCustomThemeInput());
            await service.deleteCustomTheme(theme!.id);
            const ev = service.getTelemetryLog().find(e => e.action === 'theme.custom.delete' && e.success);
            expect(ev).toBeDefined();
        });

        it('should emit failure event for non-existent id', async () => {
            await service.deleteCustomTheme('nonexistent');
            const ev = service.getTelemetryLog().find(e => e.action === 'theme.custom.delete' && !e.success);
            expect(ev).toBeDefined();
        });
    });

    // ── Telemetry on export/import ───────────────────────────────────

    describe('telemetry on exportTheme', () => {
        it('should emit success event on valid export', () => {
            service.exportTheme('graphite');
            const ev = service.getTelemetryLog().find(e => e.action === 'theme.export' && e.success);
            expect(ev).toBeDefined();
        });

        it('should emit failure event for unknown theme', () => {
            service.exportTheme('nonexistent');
            const ev = service.getTelemetryLog().find(e => e.action === 'theme.export' && !e.success);
            expect(ev).toBeDefined();
        });
    });

    describe('telemetry on importTheme', () => {
        it('should emit success event on valid import', async () => {
            const data = JSON.stringify({
                version: '1.0',
                theme: {
                    id: 'import-telem-1', name: 'Import', isDark: true, category: 'artisanal',
                    colors: validCustomThemeInput().colors,
                },
            });
            await service.importTheme(data);
            const ev = service.getTelemetryLog().find(e => e.action === 'theme.import' && e.success);
            expect(ev).toBeDefined();
        });

        it('should emit failure event on invalid import', async () => {
            await service.importTheme('bad-json');
            const ev = service.getTelemetryLog().find(e => e.action === 'theme.import' && !e.success);
            expect(ev).toBeDefined();
        });

        it('should emit failure event for wrong version', async () => {
            await service.importTheme(JSON.stringify({ version: '9.0', theme: {} }));
            const ev = service.getTelemetryLog().find(e => e.action === 'theme.import' && !e.success);
            expect(ev).toBeDefined();
        });
    });

    // ── Telemetry on presets ─────────────────────────────────────────

    describe('telemetry on applyPreset', () => {
        it('should emit success event on valid preset', async () => {
            await service.applyPreset('developer');
            const ev = service.getTelemetryLog().find(e => e.action === 'theme.preset.apply' && e.success);
            expect(ev).toBeDefined();
        });

        it('should emit failure event for non-existent preset', async () => {
            await service.applyPreset('nope');
            const ev = service.getTelemetryLog().find(e => e.action === 'theme.preset.apply' && !e.success);
            expect(ev).toBeDefined();
        });
    });

    // ── Ring buffer capping ──────────────────────────────────────────

    describe('telemetry log capping', () => {
        it('should cap telemetry log at MAX_TELEMETRY_LOG entries', async () => {
            for (let i = 0; i < 210; i++) {
                await service.setTheme('obsidian');
            }
            expect(service.getTelemetryLog().length).toBeLessThanOrEqual(200);
        });
    });

    // ── getTelemetryLog copy semantics ───────────────────────────────

    describe('getTelemetryLog', () => {
        it('should return a copy of the log', async () => {
            await service.setTheme('obsidian');
            const a = service.getTelemetryLog();
            const b = service.getTelemetryLog();
            expect(a).not.toBe(b);
            expect(a).toEqual(b);
        });

        it('should be empty initially', () => {
            // Fresh service with no operations
            expect(service.getTelemetryLog().length).toBe(0);
        });
    });

    // ── Save failure telemetry ───────────────────────────────────────

    describe('telemetry on save failure', () => {
        it('should emit theme.save.failed after all retries exhausted', async () => {
            mockWriteFile.mockRejectedValue(new Error('disk full'));
            await service.setTheme('obsidian');
            const ev = service.getTelemetryLog().find(e => e.action === 'theme.save.failed');
            expect(ev).toBeDefined();
            expect(ev!.success).toBe(false);
        });
    });
});
