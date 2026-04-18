/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
