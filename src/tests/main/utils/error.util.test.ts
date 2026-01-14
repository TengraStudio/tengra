
import { describe, it, expect } from 'vitest';
import { OrbitError, ApiError, isOrbitError, AppErrorCode } from '../../../main/utils/error.util';

describe('Error Hierarchy', () => {
    it('should correctly construct OrbitError', () => {
        class TestError extends OrbitError { }
        const err = new TestError('test', AppErrorCode.UNKNOWN, { foo: 'bar' });

        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(OrbitError);
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

    it('should identify OrbitErrors', () => {
        const err = new ApiError('fail', 'test');
        const regularErr = new Error('fail');

        expect(isOrbitError(err)).toBe(true);
        expect(isOrbitError(regularErr)).toBe(false);
    });

    it('should serialize to JSON', () => {
        const err = new ApiError('fail', 'test');
        const json = err.toJSON();

        expect(json.code).toBe(AppErrorCode.API_ERROR);
        expect(json.message).toBe('fail');
        expect(json.name).toBe('ApiError');
    });
});
