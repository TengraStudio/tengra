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
        const result1 = await (proxy.getValue() as unknown as Promise<string>);
        const result2 = await (proxy.getValue() as unknown as Promise<string>);

        expect(result1).toBe('ok');
        expect(result2).toBe('ok');

        const status = lazyServiceRegistry.getStatus();
        expect(status.registered).toContain(name);
        expect(status.loaded).toContain(name);
    });
});

