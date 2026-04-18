/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { promises as fs } from 'fs';
import path from 'path';

import { appLogger } from '@main/logging/logger';
import { isNodeError } from '@shared/utils/error.util';

export interface WorkspaceRules {
    content: string; // The raw or processed content of RULES.md
    lastModified: number;
}

export class RuleService {
    private cache: Map<string, WorkspaceRules> = new Map();

    constructor() { }

    /**
     * Reads .tengra/RULES.md from the given workspace root.
     * Returns null if file doesn't exist.
     */
    async getRules(workspaceRoot: string): Promise<string | null> {
        const rulesPath = path.join(workspaceRoot, '.tengra', 'RULES.md');

        try {
            const stats = await fs.stat(rulesPath);
            const cached = this.cache.get(rulesPath);

            // Return cached version if file hasn't changed
            if (cached?.lastModified === stats.mtimeMs) {
                return cached.content;
            }

            // Read fresh content
            appLogger.info('rule.service', `[RuleService] Loading rules from ${rulesPath}`);
            const content = await fs.readFile(rulesPath, 'utf-8');

            // Basic sanitization or parsing could happen here
            // For now, we return the raw markdown content

            this.cache.set(rulesPath, {
                content,
                lastModified: stats.mtimeMs
            });

            return content;
        } catch (error) {
            if (isNodeError(error as Error) && (error as { code?: string }).code !== 'ENOENT') {
                appLogger.warn('rule.service', `[RuleService] Error reading rules from ${rulesPath}: ${(error as Error).message}`);
            }
            return null; // File doesn't exist or error
        }
    }

    /**
     * Clears cache for a specific workspace
     */
    clearCache(workspaceRoot: string) {
        const rulesPath = path.join(workspaceRoot, '.tengra', 'RULES.md');
        this.cache.delete(rulesPath);
    }
}

