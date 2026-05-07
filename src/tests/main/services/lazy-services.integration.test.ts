/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createLazyServiceProxy, lazyServiceRegistry } from '@main/core/lazy-services';
import { describe, expect, it } from 'vitest';

class FakeLazyService {
    constructor(private readonly value: string) { }

    getValue(): string {
        return this.value;
    }
}

describe('LazyServiceRegistry integration', () => {
    it('loads a lazy service once and exposes status', async () => {
        const name = 'test-lazy-service';
        lazyServiceRegistry.register(name, async () => new FakeLazyService('ok'));

        const proxy = createLazyServiceProxy<FakeLazyService>(name);
        const result1 = await (proxy.getValue() as never as Promise<string>);
        const result2 = await (proxy.getValue() as never as Promise<string>);

        expect(result1).toBe('ok');
        expect(result2).toBe('ok');

        const status = lazyServiceRegistry.getStatus();
        expect(status.registered).toContain(name);
        expect(status.loaded).toContain(name);
    });
});


