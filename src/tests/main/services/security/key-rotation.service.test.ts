import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// import { SettingsService } from '@main/services/system/settings.service';

// Mock the logger to avoid side effects
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('KeyRotationService', () => {
    let service: KeyRotationService;
    let mockSettingsService: TestValue;

    beforeEach(() => {
        mockSettingsService = {
            getSettings: vi.fn().mockReturnValue({})
        } as never;
        service = new KeyRotationService(mockSettingsService);
    });

    it('should initialize and return the first key', () => {
        service.initializeProviderKeys('openai', 'key1,key2,key3');
        expect(service.getCurrentKey('openai')).toBe('key1');
    });

    it('should rotate keys correctly', () => {
        service.initializeProviderKeys('openai', 'key1,key2,key3');

        expect(service.getCurrentKey('openai')).toBe('key1');

        const rotated1 = service.rotateKey('openai');
        expect(rotated1).toBe(true);
        expect(service.getCurrentKey('openai')).toBe('key2');

        const rotated2 = service.rotateKey('openai');
        expect(rotated2).toBe(true);
        expect(service.getCurrentKey('openai')).toBe('key3');
    });

    it('should loop back to the first key after last key', () => {
        service.initializeProviderKeys('openai', 'key1,key2');

        service.rotateKey('openai'); // -> key2
        service.rotateKey('openai'); // -> key1

        expect(service.getCurrentKey('openai')).toBe('key1');
    });

    it('should handle single key gracefully', () => {
        service.initializeProviderKeys('openai', 'single_key');
        expect(service.getCurrentKey('openai')).toBe('single_key');

        const rotated = service.rotateKey('openai');
        expect(rotated).toBe(false); // Should return false as no alternative calls logic
        expect(service.getCurrentKey('openai')).toBe('single_key');
    });
});
