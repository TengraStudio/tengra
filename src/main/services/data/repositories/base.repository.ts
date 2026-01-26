import { DatabaseAdapter } from '@shared/types/database';
import { safeJsonParse } from '@shared/utils/sanitize.util';

export abstract class BaseRepository {
    constructor(protected readonly adapter: DatabaseAdapter) { }

    protected parseJsonField<T>(json: string | null | undefined, defaultValue: T): T {
        if (typeof json !== 'string' || json.trim() === '') {
            return defaultValue;
        }
        const first = safeJsonParse<unknown>(json, defaultValue as unknown);
        if (typeof first === 'string') {
            return safeJsonParse<T>(first, defaultValue);
        }
        return first as T;
    }
}
