/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export type CredentialMode = 'auto' | 'oauth' | 'api';

export function normalizeProviderKeys(
    primaryKey?: string,
    apiKeys?: string[]
): string[] {
    const values = [
        ...(Array.isArray(apiKeys) ? apiKeys : []),
        ...(typeof primaryKey === 'string' ? [primaryKey] : []),
    ];
    const normalized: string[] = [];

    for (const value of values) {
        for (const fragment of value.split(',')) {
            const trimmed = fragment.trim();
            if (!trimmed || normalized.includes(trimmed)) {
                continue;
            }
            normalized.push(trimmed);
        }
    }

    return normalized;
}

export function getPrimaryProviderKey(
    primaryKey?: string,
    apiKeys?: string[]
): string {
    return normalizeProviderKeys(primaryKey, apiKeys)[0] ?? '';
}

export function serializeProviderKeys(
    primaryKey?: string,
    apiKeys?: string[]
): string {
    return normalizeProviderKeys(primaryKey, apiKeys).join(',');
}

