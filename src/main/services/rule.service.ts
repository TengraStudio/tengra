import { promises as fs } from 'fs';
import path from 'path';
import { isNodeError } from '@shared/utils/error.util';

export interface WorkspaceRules {
    content: string; // The raw or processed content of RULES.md
    lastModified: number;
}

export class RuleService {
    private cache: Map<string, WorkspaceRules> = new Map();

    constructor() { }

    /**
     * Reads .orbit/RULES.md from the given project root.
     * Returns null if file doesn't exist.
     */
    async getRules(projectRoot: string): Promise<string | null> {
        const rulesPath = path.join(projectRoot, '.orbit', 'RULES.md');

        try {
            const stats = await fs.stat(rulesPath);
            const cached = this.cache.get(rulesPath);

            // Return cached version if file hasn't changed
            if (cached && cached.lastModified === stats.mtimeMs) {
                return cached.content;
            }

            // Read fresh content
            console.log(`[RuleService] Loading rules from ${rulesPath}`);
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
                console.warn(`[RuleService] Error reading rules from ${rulesPath}:`, error);
            }
            return null; // File doesn't exist or error
        }
    }

    /**
     * Clears cache for a specific project
     */
    clearCache(projectRoot: string) {
        const rulesPath = path.join(projectRoot, '.orbit', 'RULES.md');
        this.cache.delete(rulesPath);
    }
}
