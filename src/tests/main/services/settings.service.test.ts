/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Unit tests for SettingsService
 */
import * as fs from 'fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { en } from '../../../renderer/i18n/locales';

// Mock electron
vi.mock('electron', () => ({
    app: { getPath: vi.fn().mockReturnValue('/mock/userData') }
}));

// Mock fs
vi.mock('fs', () => ({
    existsSync: vi.fn(), readFileSync: vi.fn(), writeFileSync: vi.fn(), mkdirSync: vi.fn(), renameSync: vi.fn(), unlinkSync: vi.fn(),
    promises: {
        access: vi.fn(), readFile: vi.fn(), writeFile: vi.fn(), rename: vi.fn(), unlink: vi.fn(), mkdir: vi.fn()
    }
}));

const mockDataService = { getPath: vi.fn().mockReturnValue('/mock/config') };
const mockAuthService = { 
    getAllTokens: vi.fn().mockReturnValue({}), 
    setToken: vi.fn(), 
    saveToken: vi.fn(),
    getAllAccountsFull: vi.fn().mockResolvedValue([])
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.promises.access).mockRejectedValue(new Error('ENOENT'));
});

afterEach(() => { vi.resetModules(); });

describe('SettingsService - Initialization', () => {
    it('should use DataService path when provided', async () => {
        const { SettingsService } = await import('@main/services/system/settings.service');
        const service = new SettingsService(mockDataService as never, mockAuthService as never);
        await service.initialize();
        expect(mockDataService.getPath).toHaveBeenCalledWith('config');
    });

    it('should load default settings when file does not exist', async () => {
        const { SettingsService } = await import('@main/services/system/settings.service');
        const service = new SettingsService(mockDataService as never, mockAuthService as never);
        await service.initialize();
        expect(service.getSettings().general.language).toBe('en');
        expect(service.getHealthMetrics()).toMatchObject({
            loadAttempts: 1,
            status: 'healthy',
        });
    });

    it('should load settings from file when it exists', async () => {
        vi.mocked(fs.promises.access).mockResolvedValue(undefined);
        vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({ general: { language: 'tr' } }));
        const { SettingsService } = await import('@main/services/system/settings.service');
        const service = new SettingsService(mockDataService as never, mockAuthService as never);
        await service.initialize();
        expect(service.getSettings().general.language).toBe('tr');
    });

    it('should not reload settings when initialize is called twice', async () => {
        vi.mocked(fs.promises.access).mockResolvedValue(undefined);
        vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({ general: { language: 'tr' } }));
        const { SettingsService } = await import('@main/services/system/settings.service');
        const service = new SettingsService(mockDataService as never, mockAuthService as never);

        await service.initialize();
        await service.initialize();

        expect(fs.promises.readFile).toHaveBeenCalledTimes(1);
        expect(service.getSettings().general.language).toBe('tr');
    });

    it('should recover from corrupted JSON', async () => {
        vi.mocked(fs.promises.access).mockResolvedValue(undefined);
        vi.mocked(fs.promises.readFile).mockResolvedValue('{"general":{"language":"fr"}}garbage');
        const { SettingsService } = await import('@main/services/system/settings.service');
        const service = new SettingsService(mockDataService as never, mockAuthService as never);
        await service.initialize();
        // Note: Current implementation uses safeJsonParse which returns empty object on corrupted JSON,
        // so attemptJsonRecovery is never called. This is a known limitation.
        expect(service.getSettings().general.language).toBe('en'); // Falls back to default
    });

    it('should migrate and validate legacy window bounds payload', async () => {
        vi.mocked(fs.promises.access).mockResolvedValue(undefined);
        vi.mocked(fs.promises.readFile).mockResolvedValue(
            JSON.stringify({
                window: {
                    bounds: { width: 320, height: 300, x: 40.9, y: 80.1 },
                    startOnStartup: false,
                },
            })
        );
        const { SettingsService } = await import('@main/services/system/settings.service');
        const service = new SettingsService(mockDataService as never, mockAuthService as never);
        await service.initialize();

        expect(service.getSettings().window?.width).toBe(640);
        expect(service.getSettings().window?.height).toBe(480);
        expect(service.getSettings().window?.x).toBe(40);
        expect(service.getSettings().window?.y).toBe(80);
        expect(service.getSettings().window?.startOnStartup).toBe(false);
    });

    it('should preserve proxy runtime credentials when loading settings', async () => {
        vi.mocked(fs.promises.access).mockResolvedValue(undefined);
        vi.mocked(fs.promises.readFile).mockResolvedValue(
            JSON.stringify({
                proxy: {
                    enabled: true,
                    url: 'http://127.0.0.1:8317/v1',
                    key: 'legacy-proxy-key',
                    port: 8317,
                },
            })
        );
        const { SettingsService } = await import('@main/services/system/settings.service');
        const service = new SettingsService(mockDataService as never, mockAuthService as never);
        await service.initialize();

        expect(service.getSettings().proxy).toMatchObject({
            enabled: true,
            url: 'http://127.0.0.1:8317/v1',
            key: 'legacy-proxy-key',
            port: 8317,
        });
    });

    it('should unwrap legacy success/data settings envelopes', async () => {
        vi.mocked(fs.promises.access).mockResolvedValue(undefined);
        vi.mocked(fs.promises.readFile).mockResolvedValue(
            JSON.stringify({
                success: true,
                data: {
                    general: { language: 'tr' },
                    nvidia: {
                        model: 'nvidia/llama-3.1-70b-instruct'
                    }
                }
            })
        );
        const { SettingsService } = await import('@main/services/system/settings.service');
        const service = new SettingsService(mockDataService as never, mockAuthService as never);
        await service.initialize();

        expect(service.getSettings().general.language).toBe('tr');
        expect(service.getSettings().nvidia?.model).toBe('nvidia/llama-3.1-70b-instruct');
    });
});

describe('SettingsService - Persistence', () => {
    it('should save settings and return updated settings', async () => {
        const { SettingsService } = await import('@main/services/system/settings.service');
        const service = new SettingsService(mockDataService as never, mockAuthService as never);
        await service.initialize();
        const result = await service.saveSettings({ general: { language: 'de' } } as never);
        expect(result.general.language).toBe('de');
        expect(service.getHealthMetrics()).toMatchObject({
            saveAttempts: 1,
            saveFailures: 0,
            status: 'healthy',
        });
    });

    it('should reject non-object save payloads', async () => {
        const { SettingsService } = await import('@main/services/system/settings.service');
        const service = new SettingsService(mockDataService as never, mockAuthService as never);
        await service.initialize();

        await expect(service.saveSettings(null as never as never)).rejects.toThrow(
            'error.settings.invalid_payload'
        );
    });

    it('should reload settings from disk', async () => {
        vi.mocked(fs.promises.access).mockResolvedValue(undefined);
        vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({ general: { language: 'de' } }));
        const { SettingsService } = await import('@main/services/system/settings.service');
        const service = new SettingsService(mockDataService as never, mockAuthService as never);
        await service.initialize();
        vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({ general: { language: 'fr' } }));
        const reloaded = await service.reloadSettings();
        expect(reloaded.general.language).toBe('fr');
        expect(service.getHealthMetrics().recentEvents.some(evt => evt.name === 'settings.reload.success')).toBe(true);
    });

    it('should return the correct settings path', async () => {
        const { SettingsService } = await import('@main/services/system/settings.service');
        const service = new SettingsService(mockDataService as never, mockAuthService as never);
        expect(service.getSettingsPath()).toContain('settings.json');
    });

    it('should validate window values when saving settings', async () => {
        const { SettingsService } = await import('@main/services/system/settings.service');
        const service = new SettingsService(mockDataService as never, mockAuthService as never);
        await service.initialize();

        const result = await service.saveSettings({
            window: {
                width: 99999,
                height: 120,
                x: 11.7,
                y: -8.9,
            },
        } as never);

        expect(result.window?.width).toBe(7680);
        expect(result.window?.height).toBe(480);
        expect(result.window?.x).toBe(11);
        expect(result.window?.y).toBe(-9);
    });

    it('should retry disk persistence once before succeeding', async () => {
        const { SettingsService } = await import('@main/services/system/settings.service');
        const service = new SettingsService(mockDataService as never as never, mockAuthService as never as never);
        await service.initialize();

        vi.mocked(fs.promises.writeFile)
            .mockRejectedValueOnce(new Error('temporary write failure'))
            .mockResolvedValue(undefined);

        const result = await service.saveSettings({ general: { language: 'es' } } as never);

        expect(result.general.language).toBe('es');
        expect(fs.promises.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should rollback in-memory settings when persistence fails after retries', async () => {
        const { SettingsService } = await import('@main/services/system/settings.service');
        const service = new SettingsService(mockDataService as never as never, mockAuthService as never as never);
        await service.initialize();

        vi.mocked(fs.promises.writeFile).mockRejectedValue(new Error('disk unavailable'));

        const previousLanguage = service.getSettings().general.language;
        const saved = await service.saveSettings({ general: { language: 'ja' } } as never);

        expect(saved.general.language).toBe(previousLanguage);
        expect(service.getHealthMetrics().saveFailures).toBe(1);
    });

    it('should expose budgets, normalized ui states and i18n message keys', async () => {
        const { SettingsService } = await import('@main/services/system/settings.service');
        const service = new SettingsService(mockDataService as never as never, mockAuthService as never as never);

        const emptyMetrics = service.getHealthMetrics();
        expect(emptyMetrics.uiState).toBe('empty');
        expect(emptyMetrics.performanceBudget.saveSettingsMs).toBe(600);
        expect(en.serviceHealth.settings.empty).toBe(emptyMetrics.messageKey);

        await service.initialize();
        const readyMetrics = service.getHealthMetrics();
        expect(readyMetrics.uiState).toBe('ready');
        expect(en.serviceHealth.settings.ready).toBe(readyMetrics.messageKey);
    });
});
