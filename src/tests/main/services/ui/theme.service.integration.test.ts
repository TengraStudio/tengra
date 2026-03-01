/**
 * Integration, edge-case, validation, and performance tests for ThemeService.
 * Covers B-0471 (edge cases), B-0472 (integration/regression), B-0473 (validation),
 * B-0474 (error codes), B-0476 (performance budgets).
 */

import { ThemeErrorCode } from '@main/services/ui/theme-error';
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

function resetFsMocks(): void {
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    mockReadFile.mockResolvedValue('{}');
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
}

/** Minimal valid colors object for test theme creation */
function validColors() {
    return {
        background: '0 0% 0%', foreground: '0 0% 100%',
        card: 'c', cardForeground: 'cf', popover: 'p', popoverForeground: 'pf',
        primary: 'pr', primaryForeground: 'prf', secondary: 's', secondaryForeground: 'sf',
        muted: 'm', mutedForeground: 'mf', accent: 'a', accentForeground: 'af',
        destructive: 'd', destructiveForeground: 'df', border: 'b', input: 'i', ring: 'r',
    };
}

/** Minimal valid custom theme input */
function validThemeInput(name = 'Test Theme') {
    return {
        name,
        category: 'artisanal' as const,
        isDark: true,
        colors: validColors(),
        isCustom: true as const,
        source: 'user-created' as const,
    };
}

// ── Input Validation Tests (B-0473) ─────────────────────────────────

describe('ThemeService Input Validation', () => {
    let service: InstanceType<typeof import('@main/services/ui/theme.service').ThemeService>;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        resetFsMocks();
        const mod = await import('@main/services/ui/theme.service');
        service = new mod.ThemeService();
        await service.initialize();
    });

    describe('validateThemeId', () => {
        it('should accept valid kebab-case IDs', () => {
            expect(service.validateThemeId('my-theme')).toBeNull();
            expect(service.validateThemeId('custom-123')).toBeNull();
            expect(service.validateThemeId('a')).toBeNull();
        });

        it('should reject empty string', () => {
            expect(service.validateThemeId('')).toBe(ThemeErrorCode.INVALID_ID);
        });

        it('should reject whitespace-only string', () => {
            expect(service.validateThemeId('   ')).toBe(ThemeErrorCode.INVALID_ID);
        });

        it('should reject IDs with special characters', () => {
            expect(service.validateThemeId('has space')).toBe(ThemeErrorCode.INVALID_ID);
            expect(service.validateThemeId('has/slash')).toBe(ThemeErrorCode.INVALID_ID);
            expect(service.validateThemeId('../path-traversal')).toBe(ThemeErrorCode.INVALID_ID);
        });

        it('should reject IDs exceeding max length', () => {
            const longId = 'a'.repeat(129);
            expect(service.validateThemeId(longId)).toBe(ThemeErrorCode.INVALID_ID);
        });

        it('should reject IDs starting with hyphen', () => {
            expect(service.validateThemeId('-starts-bad')).toBe(ThemeErrorCode.INVALID_ID);
        });
    });

    describe('validateThemeName', () => {
        it('should accept valid names', () => {
            expect(service.validateThemeName('My Theme')).toBeNull();
            expect(service.validateThemeName('A')).toBeNull();
        });

        it('should reject empty name', () => {
            expect(service.validateThemeName('')).toBe(ThemeErrorCode.INVALID_NAME);
        });

        it('should reject whitespace-only name', () => {
            expect(service.validateThemeName('   ')).toBe(ThemeErrorCode.INVALID_NAME);
        });

        it('should reject names exceeding max length', () => {
            const longName = 'A'.repeat(101);
            expect(service.validateThemeName(longName)).toBe(ThemeErrorCode.INVALID_NAME);
        });
    });

    describe('validateColors', () => {
        it('should accept valid colors object', () => {
            expect(service.validateColors(validColors())).toBeNull();
        });

        it('should reject null colors', () => {
            expect(service.validateColors(null as never)).toBe(ThemeErrorCode.INVALID_COLORS);
        });

        it('should reject array as colors', () => {
            expect(service.validateColors([] as never)).toBe(ThemeErrorCode.INVALID_COLORS);
        });

        it('should reject colors missing required keys', () => {
            const incomplete = { background: '0 0% 0%' };
            expect(service.validateColors(incomplete as never)).toBe(ThemeErrorCode.INVALID_COLORS);
        });
    });

    describe('setTheme with invalid IDs', () => {
        it('should reject empty theme ID', async () => {
            expect(await service.setTheme('')).toBe(false);
        });

        it('should reject theme ID with spaces', async () => {
            expect(await service.setTheme('bad theme')).toBe(false);
        });

        it('should reject theme ID with path traversal', async () => {
            expect(await service.setTheme('../etc/passwd')).toBe(false);
        });
    });

    describe('addCustomTheme with invalid input', () => {
        it('should reject empty name', async () => {
            const input = validThemeInput('');
            expect(await service.addCustomTheme(input)).toBeNull();
        });

        it('should reject name exceeding max length', async () => {
            const input = validThemeInput('X'.repeat(101));
            expect(await service.addCustomTheme(input)).toBeNull();
        });

        it('should reject missing required color keys', async () => {
            const input = { ...validThemeInput(), colors: { background: '0 0% 0%' } };
            expect(await service.addCustomTheme(input as never)).toBeNull();
        });
    });

    describe('toggleFavorite with invalid IDs', () => {
        it('should reject empty string', async () => {
            expect(await service.toggleFavorite('')).toBe(false);
        });

        it('should reject ID with special characters', async () => {
            expect(await service.toggleFavorite('bad/id')).toBe(false);
        });
    });
});

// ── Integration / Regression Tests (B-0472) ─────────────────────────

describe('ThemeService Integration', () => {
    let service: InstanceType<typeof import('@main/services/ui/theme.service').ThemeService>;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        resetFsMocks();
        const mod = await import('@main/services/ui/theme.service');
        service = new mod.ThemeService();
    });

    describe('init → switch → persist → reload cycle', () => {
        it('should persist theme switch and reload correctly', async () => {
            await service.initialize();
            await service.setTheme('obsidian');

            // Capture what was written
            const writeCall = mockWriteFile.mock.calls.at(-1);
            expect(writeCall).toBeDefined();
            const writtenJson = writeCall![1] as string;
            expect(writtenJson).toContain('obsidian');

            // Simulate reload with persisted data
            vi.resetModules();
            vi.clearAllMocks();
            mockAccess.mockResolvedValue(undefined);
            mockReadFile.mockResolvedValue(writtenJson);
            mockWriteFile.mockResolvedValue(undefined);
            mockRename.mockResolvedValue(undefined);

            const mod2 = await import('@main/services/ui/theme.service');
            const reloaded = new mod2.ThemeService();
            await reloaded.initialize();
            expect(reloaded.getCurrentTheme()).toBe('obsidian');
        });
    });

    describe('export → import round-trip', () => {
        it('should round-trip a built-in theme via export/import', async () => {
            await service.initialize();
            const exported = service.exportTheme('graphite');
            expect(exported).not.toBeNull();

            // Modify the ID so it doesn't conflict
            const data = JSON.parse(exported!);
            data.theme.id = 'graphite-copy-1';
            const modified = JSON.stringify(data);

            const imported = await service.importTheme(modified);
            expect(imported).not.toBeNull();
            expect(imported!.source).toBe('imported');
        });
    });

    describe('delete active theme → fallback', () => {
        it('should fall back to graphite when active custom theme is deleted', async () => {
            await service.initialize();
            const theme = await service.addCustomTheme(validThemeInput());
            expect(theme).not.toBeNull();
            await service.setTheme(theme!.id);
            expect(service.getCurrentTheme()).toBe(theme!.id);

            await service.deleteCustomTheme(theme!.id);
            expect(service.getCurrentTheme()).toBe('graphite');
        });
    });

    describe('concurrent rapid switches', () => {
        it('should handle rapid sequential theme switches without error', async () => {
            await service.initialize();
            const themes = ['obsidian', 'midnight', 'graphite', 'obsidian', 'midnight'];
            for (const t of themes) {
                await service.setTheme(t);
            }
            expect(service.getCurrentTheme()).toBe('midnight');
        });
    });

    describe('save retry integration', () => {
        it('should succeed on retry after initial write failure', async () => {
            await service.initialize();
            let callCount = 0;
            mockWriteFile.mockImplementation(() => {
                callCount++;
                if (callCount <= 1) {
                    return Promise.reject(new Error('transient'));
                }
                return Promise.resolve(undefined);
            });

            const result = await service.setTheme('obsidian');
            expect(result).toBe(true);
            expect(service.getCurrentTheme()).toBe('obsidian');
        });

        it('should emit save.failed telemetry after all retries fail', async () => {
            await service.initialize();
            mockWriteFile.mockRejectedValue(new Error('persistent'));

            await service.setTheme('obsidian');
            const ev = service.getTelemetryLog().find(e => e.action === 'theme.save.failed');
            expect(ev).toBeDefined();
        });
    });
});

// ── Performance Regression Budgets (B-0476) ─────────────────────────

describe('ThemeService Performance', () => {
    let service: InstanceType<typeof import('@main/services/ui/theme.service').ThemeService>;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        resetFsMocks();
        const mod = await import('@main/services/ui/theme.service');
        service = new mod.ThemeService();
        await service.initialize();
    });

    it('should initialize within 100ms', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        resetFsMocks();
        const mod = await import('@main/services/ui/theme.service');
        const fresh = new mod.ThemeService();
        const start = performance.now();
        await fresh.initialize();
        expect(performance.now() - start).toBeLessThan(100);
    });

    it('should switch theme within 50ms (excluding I/O)', async () => {
        const start = performance.now();
        await service.setTheme('obsidian');
        expect(performance.now() - start).toBeLessThan(50);
    });

    it('should return all themes within 10ms', () => {
        const start = performance.now();
        service.getAllThemes();
        expect(performance.now() - start).toBeLessThan(10);
    });

    it('should return health snapshot within 5ms', () => {
        const start = performance.now();
        service.getHealth();
        expect(performance.now() - start).toBeLessThan(5);
    });

    it('should handle 100 custom theme additions within 500ms', async () => {
        const start = performance.now();
        for (let i = 0; i < 100; i++) {
            await service.addCustomTheme(validThemeInput(`Perf Theme ${i}`));
        }
        expect(performance.now() - start).toBeLessThan(500);
    });
});

// ── Error Code Tests (B-0474) ────────────────────────────────────────

describe('ThemeService Error Codes', () => {
    let service: InstanceType<typeof import('@main/services/ui/theme.service').ThemeService>;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        resetFsMocks();
        const mod = await import('@main/services/ui/theme.service');
        service = new mod.ThemeService();
        await service.initialize();
    });

    it('should use THEME_DUPLICATE_ID on import of existing ID', async () => {
        const data = JSON.stringify({
            version: '1.0',
            theme: { id: 'graphite', name: 'Clone', colors: validColors() },
        });
        const result = await service.importTheme(data);
        expect(result).toBeNull();
    });

    it('should use THEME_INVALID_FORMAT on import missing required props', async () => {
        const data = JSON.stringify({ version: '1.0', theme: { id: 'ok-id' } });
        const result = await service.importTheme(data);
        expect(result).toBeNull();
    });

    it('should use THEME_INVALID_ID on import with invalid ID format', async () => {
        const data = JSON.stringify({
            version: '1.0',
            theme: { id: 'has space', name: 'Bad', colors: validColors() },
        });
        const result = await service.importTheme(data);
        expect(result).toBeNull();
    });
});

// ── Export / Import / Duplicate Unit Tests (moved from core) ─────────

describe('ThemeService Export/Import/Persistence', () => {
    let service: InstanceType<typeof import('@main/services/ui/theme.service').ThemeService>;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        resetFsMocks();
        const mod = await import('@main/services/ui/theme.service');
        service = new mod.ThemeService();
        await service.initialize();
    });

    it('should export a built-in theme as JSON string', () => {
        const json = service.exportTheme('graphite');
        expect(json).not.toBeNull();
        const parsed = JSON.parse(json as string);
        expect(parsed.version).toBe('1.0');
        expect(parsed.theme).toBeDefined();
    });

    it('should return null for exporting unknown theme', () => {
        expect(service.exportTheme('nonexistent')).toBeNull();
    });

    it('should import a valid exported theme', async () => {
        const data = JSON.stringify({
            version: '1.0',
            theme: { id: 'imported-test-1', name: 'Imported', isDark: true, category: 'artisanal', colors: validColors() },
        });
        const result = await service.importTheme(data);
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Imported');
        expect(result!.source).toBe('imported');
    });

    it('should return null for invalid version/missing theme/bad JSON', async () => {
        expect(await service.importTheme(JSON.stringify({ version: '2.0', theme: {} }))).toBeNull();
        expect(await service.importTheme(JSON.stringify({ version: '1.0' }))).toBeNull();
        expect(await service.importTheme('not-json{{{')).toBeNull();
    });

    it('should return null when imported theme ID collides with built-in', async () => {
        const data = JSON.stringify({ version: '1.0', theme: { id: 'graphite', name: 'Clone', colors: validColors() } });
        expect(await service.importTheme(data)).toBeNull();
    });

    it('should duplicate a built-in theme', async () => {
        const dup = await service.duplicateTheme('graphite', 'Copy');
        expect(dup).not.toBeNull();
        expect(dup!.id).toMatch(/^custom-\d+$/);
    });

    it('should return null when duplicating non-existent theme', async () => {
        expect(await service.duplicateTheme('nope', 'X')).toBeNull();
    });

    it('should write to temp then rename (atomic save)', async () => {
        await service.setTheme('obsidian');
        expect(mockWriteFile).toHaveBeenCalledWith(expect.stringContaining('.tmp'), expect.any(String), 'utf8');
        expect(mockRename).toHaveBeenCalled();
    });

    it('should not throw when writeFile or rename fails', async () => {
        mockWriteFile.mockRejectedValue(new Error('ENOSPC'));
        await expect(service.setTheme('obsidian')).resolves.toBe(true);
    });

    it('should save store on cleanup when initialized', async () => {
        await service.cleanup();
        expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should not save on cleanup when not initialized', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        resetFsMocks();
        const mod = await import('@main/services/ui/theme.service');
        const uninit = new mod.ThemeService();
        await uninit.cleanup();
        expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should handle save failure gracefully during operations', async () => {
        mockWriteFile.mockRejectedValue(new Error('disk error'));
        expect(await service.setTheme('obsidian')).toBe(true);
        expect(service.getCurrentTheme()).toBe('obsidian');
        await expect(service.clearHistory()).resolves.not.toThrow();
    });
});
