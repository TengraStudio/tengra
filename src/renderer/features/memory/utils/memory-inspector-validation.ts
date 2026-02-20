import { AdvancedSemanticFragment, PendingMemory } from '@shared/types/advanced-memory';
import { JsonValue } from '@shared/types/common';
import { z } from 'zod';

const memoryIdSchema = z.string().trim().min(1);
const searchQuerySchema = z.string().max(500);
const importArrayLimit = 5000;

export const memoryInspectorErrorCodes = {
    validation: 'MEMORY_INSPECTOR_VALIDATION_ERROR',
    loadFailed: 'MEMORY_INSPECTOR_LOAD_FAILED',
    operationFailed: 'MEMORY_INSPECTOR_OPERATION_FAILED',
    importInvalidPayload: 'MEMORY_INSPECTOR_IMPORT_INVALID_PAYLOAD',
    importFailed: 'MEMORY_INSPECTOR_IMPORT_FAILED',
} as const;

export function validateMemoryId(id: string): boolean {
    return memoryIdSchema.safeParse(id).success;
}

export function validateMemorySearchQuery(query: string): boolean {
    return searchQuerySchema.safeParse(query).success;
}

type ParsedImportPayload = {
    memories: Array<Partial<AdvancedSemanticFragment>>;
    pendingMemories?: Array<Partial<PendingMemory>>;
    replaceExisting: boolean;
};

type ImportValidationResult =
    | {
        success: true;
        payload: ParsedImportPayload;
    }
    | {
        success: false;
        errorCode: string;
        messageKey: string;
    };

/**
 * Parses and validates memory import payload from JSON string.
 */
export function parseAndValidateMemoryImportPayload(
    fileContent: string,
    replaceExisting: boolean
): ImportValidationResult {
    const isObjectArray = (value: JsonValue): value is Array<Record<string, JsonValue | undefined>> =>
        Array.isArray(value) &&
        value.length <= importArrayLimit &&
        value.every(item => typeof item === 'object' && item !== null && !Array.isArray(item));

    const toInvalidPayloadError = (): ImportValidationResult => ({
        success: false,
        errorCode: memoryInspectorErrorCodes.importInvalidPayload,
        messageKey: 'memory.errors.importFailed',
    });

    try {
        const parsed = JSON.parse(fileContent) as JsonValue;

        if (Array.isArray(parsed)) {
            if (!isObjectArray(parsed)) { return toInvalidPayloadError(); }
            return {
                success: true,
                payload: { memories: parsed as Array<Partial<AdvancedSemanticFragment>>, replaceExisting },
            };
        }

        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return toInvalidPayloadError();
        }
        const parsedObject = parsed as Record<string, JsonValue | undefined>;
        const memoriesValue = parsedObject.memories;
        const pendingValue = parsedObject.pendingMemories;

        if (!Array.isArray(memoriesValue) && memoriesValue !== undefined) {
            return toInvalidPayloadError();
        }
        if (!Array.isArray(pendingValue) && pendingValue !== undefined) {
            return toInvalidPayloadError();
        }

        if ((Array.isArray(memoriesValue) && !isObjectArray(memoriesValue as JsonValue)) ||
            (Array.isArray(pendingValue) && !isObjectArray(pendingValue as JsonValue))) {
            return toInvalidPayloadError();
        }

        const memories = Array.isArray(memoriesValue)
            ? (memoriesValue as Array<Partial<AdvancedSemanticFragment>>)
            : [];
        const pendingMemories = Array.isArray(pendingValue)
            ? (pendingValue as Array<Partial<PendingMemory>>)
            : [];

        return {
            success: true,
            payload: {
                memories,
                pendingMemories,
                replaceExisting,
            },
        };
    } catch {
        return toInvalidPayloadError();
    }
}
