import { DatabaseAdapter, SqlValue } from '@shared/types/database';
import { safeJsonParse } from '@shared/utils/sanitize.util';

export abstract class BaseRepository {
    constructor(protected readonly adapter: DatabaseAdapter) { }

    protected async selectAllPaginated<T>(
        baseSql: string,
        params: SqlValue[] = [],
        pageSize: number = 500
    ): Promise<T[]> {
        const allRows: T[] = [];
        let offset = 0;

        const maxPages = 10000;
        for (let page = 0; page < maxPages; page += 1) {
            const rows = await this.adapter
                .prepare(`${baseSql} LIMIT ? OFFSET ?`)
                .all<T>(...params, pageSize, offset);
            allRows.push(...rows);
            if (rows.length < pageSize) {
                break;
            }
            offset += pageSize;
        }

        return allRows;
    }

    protected parseJsonField<T>(json: string | null | undefined, defaultValue: T): T {
        if (typeof json !== 'string' || json.trim() === '') {
            return defaultValue;
        }
        const first = safeJsonParse<RuntimeValue>(json, defaultValue as RuntimeValue);
        if (typeof first === 'string') {
            return safeJsonParse<T>(first, defaultValue);
        }
        return first as T;
    }
}
