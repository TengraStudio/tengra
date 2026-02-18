import * as fs from 'fs';

import { DataService } from '@main/services/data/data.service';
import { FeatureFlag, FeatureFlagService } from '@main/services/external/feature-flag.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const FEATURES_PATH = '/mock/config/features.json';

const flushMicrotasks = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
};

const createService = (): FeatureFlagService => {
    const dataServiceMock: Pick<DataService, 'getPath'> = {
        getPath: vi.fn().mockReturnValue('/mock/config'),
    };

    return new FeatureFlagService(dataServiceMock as unknown as DataService);
};

describe('FeatureFlagService', () => {
    let service: FeatureFlagService;

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
        vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
        vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('ENOENT'));
        vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

        service = createService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('loads feature flags from disk during initialization', async () => {
        const loadedFlags: FeatureFlag[] = [
            { id: 'alpha', enabled: true, description: 'Alpha feature' },
            { id: 'beta', enabled: false, description: 'Beta feature' },
        ];
        vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(loadedFlags));

        await service.initialize();

        expect(fs.promises.readFile).toHaveBeenCalledWith(FEATURES_PATH, 'utf-8');
        expect(service.isEnabled('alpha')).toBe(true);
        expect(service.isEnabled('beta')).toBe(false);
        expect(service.getAllFlags()).toEqual(loadedFlags);
    });

    it('creates config directory when missing and persists toggle changes', async () => {
        const loadedFlags: FeatureFlag[] = [{ id: 'beta', enabled: false }];
        vi.mocked(fs.promises.access).mockRejectedValueOnce(new Error('ENOENT'));
        vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(loadedFlags));

        await service.initialize();
        service.enable('beta');
        await flushMicrotasks();

        expect(fs.promises.mkdir).toHaveBeenCalledWith('/mock/config', { recursive: true, mode: 0o700 });
        expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);

        const enablePayload = String(vi.mocked(fs.promises.writeFile).mock.calls[0]?.[1]);
        const enabledFlags = JSON.parse(enablePayload) as FeatureFlag[];
        expect(enabledFlags.find(flag => flag.id === 'beta')?.enabled).toBe(true);

        service.disable('beta');
        await flushMicrotasks();

        expect(fs.promises.writeFile).toHaveBeenCalledTimes(2);
        const disablePayload = String(vi.mocked(fs.promises.writeFile).mock.calls[1]?.[1]);
        const disabledFlags = JSON.parse(disablePayload) as FeatureFlag[];
        expect(disabledFlags.find(flag => flag.id === 'beta')?.enabled).toBe(false);
    });
});
