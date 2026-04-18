/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it, vi } from 'vitest';

describe('Database Contract', () => {
    it('contains required audit-log contract methods', async () => {
        const fs = await vi.importActual<typeof import('node:fs')>('node:fs');
        const path = await vi.importActual<typeof import('node:path')>('node:path');
        const ROOT = process.cwd();
        const SYSTEM_REPO = path.join(ROOT, 'src', 'main', 'services', 'data', 'repositories', 'system.repository.ts');
        const DB_SERVICE = path.join(ROOT, 'src', 'main', 'services', 'data', 'database.service.ts');
        const repo = fs.readFileSync(SYSTEM_REPO, 'utf8');
        const service = fs.readFileSync(DB_SERVICE, 'utf8');

        expect(repo).toContain('addAuditLog');
        expect(repo).toContain('getAuditLogs');
        expect(repo).toContain('clearAuditLogs');

        expect(service).toContain('async addAuditLog');
        expect(service).toContain('async getAuditLogs');
        expect(service).toContain('async clearAuditLogs');
    });
});
