import {
    memoryInspectorErrorCodes,
    parseAndValidateMemoryImportPayload,
    validateMemoryId,
    validateMemorySearchQuery,
} from '@/features/memory/utils/memory-inspector-validation';
import { describe, expect, it } from 'vitest';

describe('memory inspector validation', () => {
    it('validates memory ids', () => {
        expect(validateMemoryId('memory-1')).toBe(true);
        expect(validateMemoryId('')).toBe(false);
    });

    it('validates search query length', () => {
        expect(validateMemorySearchQuery('quick query')).toBe(true);
        expect(validateMemorySearchQuery('x'.repeat(600))).toBe(false);
    });

    it('parses valid import array payload', () => {
        const result = parseAndValidateMemoryImportPayload(
            JSON.stringify([{ id: 'm1', content: 'hello' }]),
            false
        );

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.payload.memories.length).toBe(1);
        }
    });

    it('rejects malformed import payload', () => {
        const result = parseAndValidateMemoryImportPayload(
            '{"memories":"invalid"}',
            false
        );

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.errorCode).toBe(memoryInspectorErrorCodes.importInvalidPayload);
        }
    });
});
