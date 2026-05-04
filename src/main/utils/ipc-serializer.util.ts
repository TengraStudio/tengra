/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Type-safe serialization helpers for IPC boundary conversions.
 * Replaces ad-hoc `as unknown as` double-casts with explicit, auditable functions.
 */
import { JsonObject, JsonValue } from '@shared/types/common';

export function serializeToIpc(value: unknown): JsonValue {
    if (value === null || value === undefined) { return null; }
    if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
        return value;
    }
    return JSON.parse(JSON.stringify(value)) as JsonValue;
}


/**
 * Converts a Zod-validated record to a JsonObject for database write operations.
 * The caller must ensure the value has been validated before calling this function.
 */
export function validatedToJsonObject(value: Record<string, RuntimeValue>): JsonObject {
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
export function validatedAs<T extends object>(value: Partial<T> | Record<string, RuntimeValue>): T {
    return { ...value } as T;
}
