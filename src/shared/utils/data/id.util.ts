/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { randomUUID } from 'crypto';

/**
 * Generates a cryptographically secure unique ID using crypto.randomUUID()
 * Replaces insecure Math.random() based ID generation
 *
 * @returns A UUID v4 string (e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
export function generateSecureId(): string {
    return randomUUID();
}

/**
 * Generates a secure ID with a prefix for categorized IDs
 *
 * @param prefix - The prefix to prepend (e.g., "mem", "call", "term")
 * @returns A prefixed UUID (e.g., "mem_550e8400-e29b-41d4-a716-446655440000")
 */
export function generatePrefixedId(prefix: string): string {
    return `${prefix}_${randomUUID()}`;
}

/**
 * Generates a secure ID with timestamp prefix for time-ordered IDs
 * Useful for logs and events where chronological ordering is needed
 *
 * @returns A timestamp-prefixed UUID (e.g., "1706789012345-550e8400-e29b-41d4")
 */
export function generateTimestampedId(): string {
    return `${Date.now()}-${randomUUID().substring(0, 18)}`;
}

/**
 * Generates a short secure ID (first 8 characters of UUID)
 * Use only when full UUID is not needed and collisions are acceptable
 *
 * @returns A short UUID segment (e.g., "550e8400")
 */
export function generateShortId(): string {
    return randomUUID().substring(0, 8);
}
