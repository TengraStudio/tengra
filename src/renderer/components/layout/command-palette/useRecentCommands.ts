const STORAGE_KEY = 'tengra:recent-commands';
const MAX_RECENT = 5;

/**
 * Retrieves recent command IDs from localStorage.
 */
export function getRecentCommandIds(): string[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter((v): v is string => typeof v === 'string').slice(0, MAX_RECENT);
    } catch {
        return [];
    }
}

/**
 * Records a command ID as recently used.
 */
export function addRecentCommandId(id: string): void {
    const current = getRecentCommandIds();
    const updated = [id, ...current.filter(c => c !== id)].slice(0, MAX_RECENT);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
        // localStorage full or unavailable — silently ignore
    }
}
