import { describe, it, expect, beforeEach } from 'vitest';
import { Container, Scope } from './container';

describe('Container', () => {
    let container: Container;

    beforeEach(() => {
        container = new Container();
    });

    it('should register and resolve an instance', () => {
        const instance = { id: 1 };
        container.registerInstance('test', instance);
        expect(container.resolve('test')).toBe(instance);
    });

    it('should register and resolve a singleton factory', () => {
        let count = 0;
        const factory = () => ({ id: ++count });

        container.register('test', factory, [], Scope.SINGLETON);

        const instance1 = container.resolve<any>('test');
        const instance2 = container.resolve<any>('test');

        expect(instance1.id).toBe(1);
        expect(instance1).toBe(instance2);
    });

    it('should register and resolve a transient factory', () => {
        let count = 0;
        const factory = () => ({ id: ++count });

        container.register('test', factory, [], Scope.TRANSIENT);

        const instance1 = container.resolve<any>('test');
        const instance2 = container.resolve<any>('test');

        expect(instance1.id).toBe(1);
        expect(instance2.id).toBe(2);
        expect(instance1).not.toBe(instance2);
    });

    it('should resolve dependencies', () => {
        const dep = { name: 'dependency' };
        container.registerInstance('dep', dep);

        container.register('service', (d) => ({ dep: d }), ['dep']);

        const service = container.resolve<any>('service');
        expect(service.dep).toBe(dep);
    });

    it('should throw error for missing service', () => {
        expect(() => container.resolve('missing')).toThrow();
    });
});
