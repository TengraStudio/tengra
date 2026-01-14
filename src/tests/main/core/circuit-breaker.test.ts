import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker, CircuitState } from '@main/core/circuit-breaker';

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
            try { await breaker.execute(action); } catch { }
        }

        expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should block requests when OPEN', async () => {
        const action = vi.fn().mockResolvedValue('success');

        // Force open
        // @ts-ignore - access private for setup
        breaker.transitionTo(CircuitState.OPEN);

        await expect(breaker.execute(action)).rejects.toThrow(/OPEN/);
        expect(action).not.toHaveBeenCalled();
    });

    it('should transition to HALF_OPEN after timeout', async () => {
        const action = vi.fn().mockResolvedValue('success');

        // Force open
        // @ts-ignore
        breaker.transitionTo(CircuitState.OPEN);

        // Wait for timeout
        await new Promise(r => setTimeout(r, 110));

        // Next call should execute (HALF_OPEN logic is lazy in execute check)
        await breaker.execute(action);

        // Should be CLOSED after success
        expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reopen if HALF_OPEN fails', async () => {
        const action = vi.fn().mockRejectedValue(new Error('fail'));

        // Force open then wait
        // @ts-ignore
        breaker.transitionTo(CircuitState.OPEN);
        await new Promise(r => setTimeout(r, 110));

        try { await breaker.execute(action); } catch { }

        expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
});
