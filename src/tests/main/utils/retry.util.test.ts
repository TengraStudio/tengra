/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */


import { getErrorMessage, isNonRetryableError,withRetry } from '@main/utils/retry.util';
import { describe, expect, it, vi } from 'vitest';

describe('retry.util', () => {
    describe('withRetry', () => {
        it('should succeed on first try', async () => {
            const fn = vi.fn().mockResolvedValue('success');
            const result = await withRetry(fn);
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should retry on failure and succeed', async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce({ code: 'ECONNRESET' })
                .mockResolvedValue('success');

            const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should throw after max retries', async () => {
            const fn = vi.fn().mockRejectedValue({ code: 'ECONNRESET' });

            await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 10 })).rejects.toEqual({ code: 'ECONNRESET' });
            expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
        });

        it('should not retry non-retryable errors', async () => {
            const fn = vi.fn().mockRejectedValue({ status: 401, message: 'Unauthorized' });

            await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 10 })).rejects.toEqual({ status: 401, message: 'Unauthorized' });
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should call onRetry callback', async () => {
            const onRetry = vi.fn();
            const fn = vi.fn()
                .mockRejectedValueOnce({ status: 500 })
                .mockResolvedValue('success');

            await withRetry(fn, { maxRetries: 2, baseDelayMs: 10, onRetry });
            expect(onRetry).toHaveBeenCalledTimes(1);
            expect(onRetry).toHaveBeenCalledWith({ status: 500 }, 0, expect.any(Number));
        });
    });

    describe('getErrorMessage', () => {
        it('should extract message from string', () => {
            expect(getErrorMessage('Error message')).toBe('Error message');
        });

        it('should extract message from Error object', () => {
            expect(getErrorMessage(new Error('Test error'))).toBe('Test error');
        });

        it('should extract nested error message', () => {
            expect(getErrorMessage({ error: { message: 'Nested error' } })).toBe('Nested error');
        });

        it('should return Unknown error for empty object', () => {
            expect(getErrorMessage({})).toBe('Unknown error');
        });
    });

    describe('isNonRetryableError', () => {
        it('should detect 401 as non-retryable', () => {
            expect(isNonRetryableError({ status: 401 })).toBe(true);
        });

        it('should detect invalid API key as non-retryable', () => {
            expect(isNonRetryableError({ message: 'Invalid API Key provided' })).toBe(true);
        });

        it('should detect 500 as retryable', () => {
            expect(isNonRetryableError({ status: 500 })).toBe(false);
        });
    });
});
