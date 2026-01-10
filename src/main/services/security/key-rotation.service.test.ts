import { describe, it, expect, beforeEach } from 'vitest';
import { KeyRotationService } from './key-rotation.service';
// import { SettingsService } from '../settings.service';

describe('KeyRotationService', () => {
    let service: KeyRotationService;
    let mockSettingsService: any;

    beforeEach(() => {
        mockSettingsService = {} as any;
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
