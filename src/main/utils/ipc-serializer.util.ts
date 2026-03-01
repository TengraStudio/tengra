/**
 * Type-safe serialization helpers for IPC boundary conversions.
 * Replaces ad-hoc `as unknown as` double-casts with explicit, auditable functions.
 */
import { JsonObject, JsonValue } from '@shared/types/common';

/**
 * Serializes a domain object (which may contain Dates, etc.) to an IPC-safe value.
 * Uses JSON round-trip to guarantee the result is a valid JsonValue.
 */
export function serializeToIpc(value: object | object[] | null | undefined): JsonValue {
    if (value == null) {return null;}
    return JSON.parse(JSON.stringify(value)) as JsonValue;
}

/**
 * Converts a Zod-validated record to a JsonObject for database write operations.
 * The caller must ensure the value has been validated before calling this function.
 */
export function validatedToJsonObject(value: Record<string, unknown>): JsonObject {
    const result: JsonObject = {};
    for (const [key, val] of Object.entries(value)) {
        result[key] = val as JsonObject[string];
    }
    return result;
}

/**
 * Converts a Zod-validated input to a target database type.
 * Performs a shallow copy to ensure a plain object, then asserts the target type.
 * The caller must ensure the value has been schema-validated before calling.
 */
export function validatedAs<T extends object>(value: Partial<T> | Record<string, unknown>): T {
    return { ...value } as T;
}
