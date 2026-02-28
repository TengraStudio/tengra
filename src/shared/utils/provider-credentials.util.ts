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
