/**
 * Unit tests for ManualTriggerHandler (BACKLOG-0431)
 * Covers: trigger registration, unregistration, firing, callback management
 */
import { ManualTriggerHandler } from '@main/services/workflow/triggers/manual.trigger';
import { WorkflowTrigger } from '@shared/types/workflow.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createTrigger = (id: string): WorkflowTrigger => ({
    id,
    type: 'manual',
    config: {},
});

describe('ManualTriggerHandler', () => {
    let handler: ManualTriggerHandler;

    beforeEach(() => {
        handler = new ManualTriggerHandler();
    });

    it('has type "manual"', () => {
        expect(handler.type).toBe('manual');
    });

    describe('register', () => {
        it('registers a callback for a trigger id', () => {
            const callback = vi.fn();
            handler.register(createTrigger('t1'), callback);
            handler.trigger('t1');
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('replaces callback when registering same trigger id twice', () => {
            const first = vi.fn();
            const second = vi.fn();

            handler.register(createTrigger('t1'), first);
            handler.register(createTrigger('t1'), second);
            handler.trigger('t1');

            expect(first).not.toHaveBeenCalled();
            expect(second).toHaveBeenCalledTimes(1);
        });

        it('supports multiple distinct trigger ids', () => {
            const cb1 = vi.fn();
            const cb2 = vi.fn();

            handler.register(createTrigger('t1'), cb1);
            handler.register(createTrigger('t2'), cb2);

            handler.trigger('t1');
            expect(cb1).toHaveBeenCalledTimes(1);
            expect(cb2).not.toHaveBeenCalled();

            handler.trigger('t2');
            expect(cb2).toHaveBeenCalledTimes(1);
        });
    });

    describe('unregister', () => {
        it('removes a registered callback', () => {
            const callback = vi.fn();
            const trigger = createTrigger('t1');

            handler.register(trigger, callback);
            handler.unregister(trigger);
            handler.trigger('t1');

            expect(callback).not.toHaveBeenCalled();
        });

        it('does not throw when unregistering a non-existent trigger', () => {
            expect(() => handler.unregister(createTrigger('nonexistent'))).not.toThrow();
        });
    });

    describe('trigger', () => {
        it('invokes the registered callback', () => {
            const callback = vi.fn();
            handler.register(createTrigger('t1'), callback);
            handler.trigger('t1');
            expect(callback).toHaveBeenCalledOnce();
        });

        it('passes context to the callback', () => {
            const callback = vi.fn();
            handler.register(createTrigger('t1'), callback);
            handler.trigger('t1', { key: 'value' });
            expect(callback).toHaveBeenCalledWith({ key: 'value' });
        });

        it('passes undefined context when none provided', () => {
            const callback = vi.fn();
            handler.register(createTrigger('t1'), callback);
            handler.trigger('t1');
            expect(callback).toHaveBeenCalledWith(undefined);
        });

        it('does nothing when triggering an unregistered id', () => {
            expect(() => handler.trigger('nonexistent')).not.toThrow();
        });

        it('can be triggered multiple times', () => {
            const callback = vi.fn();
            handler.register(createTrigger('t1'), callback);

            handler.trigger('t1');
            handler.trigger('t1');
            handler.trigger('t1');

            expect(callback).toHaveBeenCalledTimes(3);
        });
    });
});
