import webElectronMock from '@renderer/web-bridge';
import { describe, expect, it } from 'vitest';

describe('session collaboration aliases', () => {
    it('exposes canonical model collaboration alongside the legacy alias', () => {
        expect(webElectronMock.modelCollaboration).toBeDefined();
        expect(webElectronMock.collaboration).toBeDefined();
        expect(typeof webElectronMock.modelCollaboration.run).toBe('function');
        expect(typeof webElectronMock.collaboration.run).toBe('function');
    });

    it('exposes canonical live collaboration alongside the legacy alias', () => {
        expect(webElectronMock.liveCollaboration).toBeDefined();
        expect(webElectronMock.userCollaboration).toBeDefined();
        expect(typeof webElectronMock.liveCollaboration.joinRoom).toBe('function');
        expect(typeof webElectronMock.userCollaboration.joinRoom).toBe('function');
    });
});
