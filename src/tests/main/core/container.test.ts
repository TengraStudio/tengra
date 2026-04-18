/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Container, Scope } from '@main/core/container';
import { beforeEach,describe, expect, it, vi } from 'vitest';

interface NamedDependency {
    name: string;
}

describe('Container', () => {
    let container: Container;

    beforeEach(() => {
        container = new Container();
    });

    it('should register and resolve a singleton', () => {
        const factory = () => ({ id: Math.random() });
        container.register('service', factory, [], Scope.SINGLETON);

        const instance1 = container.resolve<{ id: number }>('service');
        const instance2 = container.resolve<{ id: number }>('service');

        expect(instance1).toBeDefined();
        expect(instance1.id).toBe(instance2.id);
    });

    it('should register and resolve a transient service', () => {
        const factory = () => ({ id: Math.random() });
        container.register('service', factory, [], Scope.TRANSIENT);

        const instance1 = container.resolve<{ id: number }>('service');
        const instance2 = container.resolve<{ id: number }>('service');

        expect(instance1.id).not.toBe(instance2.id);
    });

    it('should resolve dependencies', () => {
        const depFactory = () => ({ name: 'dependency' });
        const serviceFactory = (dep: RuntimeValue) => {
            if (typeof dep === 'object' && dep && 'name' in dep) {
                return { depName: (dep as NamedDependency).name };
            }
            throw new Error('Dependency name is missing');
        };

        container.register('dep', depFactory);
        container.register('service', serviceFactory, ['dep']);

        const service = container.resolve<{ depName: string }>('service');
        expect(service.depName).toBe('dependency');
    });

    it('should run init lifecycle method for singletons', async () => {
        const initMock = vi.fn();
        const service = {
            initialize: initMock
        };

        container.register('service', () => service);
        await container.init();

        expect(initMock).toHaveBeenCalled();
    });

    it('should run dispose lifecycle method in reverse order', async () => {
        // We'll create a call order array to verify reverse cleanup
        const callOrder: string[] = [];

        const service1 = {
            initialize: () => { },
            cleanup: async () => { await new Promise(r => setTimeout(r, 1)); callOrder.push('service1'); }
        };

        const service2 = {
            initialize: () => { },
            cleanup: async () => { callOrder.push('service2'); }
        };

        container.register('service1', () => service1);
        container.register('service2', () => service2);

        // Resolve them to instantiate (since singletons are lazy)
        // Order of instantiation matters for 'reverse order' logic often
        container.resolve('service1');
        container.resolve('service2');

        await container.dispose();

        // If registered/resolved as service1 then service2, 
        // singletons list might be [service1, service2].
        // Reverse is [service2, service1].
        expect(callOrder).toEqual(['service2', 'service1']);
    });
});
