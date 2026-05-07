/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it } from 'vitest';

import webElectronMock from '@/web-bridge';

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

