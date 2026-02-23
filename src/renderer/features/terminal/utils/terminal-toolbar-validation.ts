export function sanitizeShellId(raw: unknown): string | null {
    if (typeof raw !== 'string') {
        return null;
    }
    const normalized = raw.trim();
    return normalized.length > 0 ? normalized : null;
}

export function sanitizeBackendId(raw: unknown): string | undefined {
    if (typeof raw !== 'string') {
        return undefined;
    }
    const normalized = raw.trim();
    return normalized.length > 0 ? normalized : undefined;
}
