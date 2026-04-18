/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { CircuitBreaker, CircuitState } from '@main/core/circuit-breaker';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('CircuitBreaker', () => {
    let breaker: CircuitBreaker;
    const options = {
        failureThreshold: 3,
        resetTimeoutMs: 100,
        serviceName: 'TestService'
    };

    beforeEach(() => {
        breaker = new CircuitBreaker(options);
    });

    const openCircuit = async (): Promise<void> => {
        const failingAction = vi.fn().mockRejectedValue(new Error('fail'));
        for (let i = 0; i < 3; i++) {
            await expect(breaker.execute(failingAction)).rejects.toThrow('fail');
        }
        expect(breaker.getState()).toBe(CircuitState.OPEN);
    };

    it('should start in CLOSED state', () => {
        expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should execute successful action', async () => {
        const action = vi.fn().mockResolvedValue('success');
        const result = await breaker.execute(action);
        expect(result).toBe('success');
        expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should open circuit after N failures', async () => {
        const action = vi.fn().mockRejectedValue(new Error('fail'));

        // Fail 3 times
        for (let i = 0; i < 3; i++) {
            await expect(breaker.execute(action)).rejects.toThrow('fail');
        }

        expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should block requests when OPEN', async () => {
        const action = vi.fn().mockResolvedValue('success');

        await openCircuit();

        await expect(breaker.execute(action)).rejects.toThrow(/OPEN/);
        expect(action).not.toHaveBeenCalled();
    });

    it('should transition to HALF_OPEN after timeout', async () => {
        const action = vi.fn().mockResolvedValue('success');

        await openCircuit();

        // Wait for timeout
        await new Promise(r => setTimeout(r, 110));

        // Next call should execute (HALF_OPEN logic is lazy in execute check)
        await breaker.execute(action);

        // Should be CLOSED after success
        expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reopen if HALF_OPEN fails', async () => {
        const action = vi.fn().mockRejectedValue(new Error('fail'));

        await openCircuit();
        await new Promise(r => setTimeout(r, 110));

        await expect(breaker.execute(action)).rejects.toThrow('fail');

        expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
});
