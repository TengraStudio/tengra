
import { ApiError, AppErrorCode, isTengraError, TengraError } from '@shared/utils/error.util';
import { describe, expect, it } from 'vitest';

describe('Error Hierarchy', () => {
    it('should correctly construct TengraError', () => {
        class TestError extends TengraError { }
        const err = new TestError('test', AppErrorCode.UNKNOWN, { foo: 'bar' });

        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(TengraError);
        expect(err.message).toBe('test');
        expect(err.code).toBe(AppErrorCode.UNKNOWN);
        expect(err.context).toEqual({ foo: 'bar' });
        expect(err.timestamp).toBeDefined();
    });

    it('should correctly construct ApiError', () => {
        const err = new ApiError('api fail', 'openai', 500, true);

        expect(err.code).toBe(AppErrorCode.API_ERROR);
        expect(err.provider).toBe('openai');
        expect(err.statusCode).toBe(500);
        expect(err.retryable).toBe(true);
    });

    it('should identify TengraErrors', () => {
        const err = new ApiError('fail', 'test');
        const regularErr = new Error('fail');

        expect(isTengraError(err)).toBe(true);
        expect(isTengraError(regularErr)).toBe(false);
    });

    it('should serialize to JSON', () => {
        const err = new ApiError('fail', 'test');
        const json = err.toJSON();

        expect(json.code).toBe(AppErrorCode.API_ERROR);
        expect(json.message).toBe('fail');
        expect(json.name).toBe('ApiError');
    });
});

