import { appLogger } from '@main/logging/logger';
import { DatabaseService } from '@main/services/data/database.service';

export interface WorkspaceRules {
    content: string; // The raw or processed content of project guidelines
    lastModified: number;
}

export class RuleService {
    static readonly serviceName = 'ruleService';
    static readonly dependencies = ['databaseService'] as const;
    private cache: Map<string, WorkspaceRules> = new Map();

    constructor(private readonly databaseService: DatabaseService) { }

    /**
     * Reads rules for a specific workspace from the database.
     * Returns null if no rules are set or workspace not found.
     */
    async getRules(workspaceId: string): Promise<string | null> {
        try {
            const workspace = await this.databaseService.workspaces.getWorkspace(workspaceId);

            if (!workspace) {
                return null;
            }

            if (workspace.rules && workspace.rules.trim().length > 0) {
                const cached = this.cache.get(workspaceId);
                const lastModified = workspace.updatedAt;

                if (cached?.lastModified === lastModified) {
                    return cached.content;
                }

                this.cache.set(workspaceId, { content: workspace.rules, lastModified });
                return workspace.rules;
            }

            return null;
        } catch (error) {
            appLogger.warn('rule.service', `[RuleService] Error fetching rules for workspace ${workspaceId}: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * Updates rules for a specific workspace in the database.
     */
    async updateRules(workspaceId: string, content: string): Promise<boolean> {
        try {
            const result = await this.databaseService.workspaces.updateWorkspace(workspaceId, { rules: content });

            if (result) {
                this.cache.delete(workspaceId);
                return true;
            }
            return false;
        } catch (error) {
            appLogger.error('rule.service', `[RuleService] Failed to update rules for ${workspaceId}`, error as Error);
            return false;
        }
    }

    /**
     * Clears cache for a specific workspace
     */
    clearCache(workspaceId: string) {
        this.cache.delete(workspaceId);
    }
}

