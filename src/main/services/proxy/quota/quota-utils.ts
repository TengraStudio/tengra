import { JsonObject, JsonValue } from '@shared/types/common';

export class QuotaUtils {
    static findInObject<T>(
        root: JsonValue,
        keys: string[],
        predicate: (val: JsonValue) => T | null,
        maxDepth: number = 4
    ): T | null {
        const queue: Array<{ value: JsonValue; depth: number }> = [{ value: root, depth: 0 }];
        while (queue.length > 0) {
            const current = queue.shift();
            if (!current || !current.value || typeof current.value !== 'object') {
                continue;
            }

            const { value, depth } = current;
            const obj = value as JsonObject;

            // Search current level keys if not array
            if (!Array.isArray(obj)) {
                for (const key of keys) {
                    const candidate = obj[key];
                    if (candidate !== undefined && candidate !== null) {
                        const result = predicate(candidate);
                        if (result !== null) { return result; }
                    }
                }
            }

            // Go deeper
            if (depth < maxDepth) {
                const children = Array.isArray(obj) ? (obj as unknown as JsonValue[]) : Object.values(obj);
                for (const child of children) {
                    if (child && typeof child === 'object') {
                        queue.push({ value: child, depth: depth + 1 });
                    }
                }
            }
        }
        return null;
    }

    static findNumberByKeys(root: JsonValue, keys: string[]): number | null {
        return this.findInObject(root, keys, (val) => {
            const num = Number(val);
            return !Number.isNaN(num) ? num : null;
        });
    }

    static findStringByKeys(root: JsonValue, keys: string[]): string | null {
        return this.findInObject(root, keys, (val) => {
            if (typeof val === 'string' && val.trim()) {
                return val.trim();
            }
            return null;
        });
    }

    static normalizeResetAt(value: JsonValue): string | null {
        if (typeof value === 'string' && value.trim()) { return value.trim(); }
        const numeric = this.toNumber(value);
        if (numeric === null) { return null; }
        const ms = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
        return new Date(ms).toISOString();
    }

    static toNumber(value: JsonValue): number | null {
        if (typeof value === 'number' && Number.isFinite(value)) { return value; }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) { return null; }
            const parsed = Number(trimmed);
            if (!Number.isNaN(parsed)) { return parsed; }
        }
        return null;
    }

    static calculatePercentage(usage: number | null, limit: number | null): number | null {
        if (usage === null || limit === null || limit <= 0) { return null; }
        return Math.min(100, Math.max(0, (usage / limit) * 100));
    }

    static normalizePercent(value: number | null): number | null {
        if (value === null || !Number.isFinite(value)) { return null; }
        if (value >= 0 && value <= 1) { return value * 100; }
        return value;
    }

    static asObject(value: JsonValue | undefined): JsonObject | null {
        if (!value || typeof value !== 'object' || Array.isArray(value)) { return null; }
        return value as JsonObject;
    }
}
