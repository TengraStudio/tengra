import { JsonObject } from '@shared/types/common';
import { DatabaseAdapter } from '@shared/types/database';
import {
    IdeaCategory,
    IdeaCompetitor,
    IdeaGenerationStage,
    IdeaSession,
    IdeaSessionStatus,
    IdeaStatus,
    ProjectIdea,
    ProjectRoadmap,
    ResearchData,
    TechStack,
} from '@shared/types/ideas';
import { safeJsonParse } from '@shared/utils/sanitize.util';

/**
 * Idea Repository
 * Handles all database operations for IdeaGeneratorService
 * Follows the Repository pattern for clean separation of data access
 */
export class IdeaRepository {
    constructor(private db: DatabaseAdapter) { }

    // ==================== Session Operations ====================

    async createSession(session: IdeaSession): Promise<void> {
        const stmt = this.db.prepare(
            `INSERT INTO idea_sessions (
                id, model, provider, categories, max_ideas, ideas_generated,
                status, research_data, custom_prompt, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        await stmt.run(
            session.id,
            session.model,
            session.provider,
            JSON.stringify(session.categories),
            session.maxIdeas,
            session.ideasGenerated,
            session.status,
            session.researchData ? JSON.stringify(session.researchData) : null,
            session.customPrompt ?? null,
            session.createdAt,
            session.updatedAt,
        );
    }

    async getSession(id: string): Promise<IdeaSession | null> {
        const result = await this.db.query<JsonObject>(
            'SELECT * FROM idea_sessions WHERE id = ?',
            [id]
        );
        return result.rows.length > 0 ? this.mapRowToSession(result.rows[0]) : null;
    }

    async getSessions(): Promise<IdeaSession[]> {
        const result = await this.db.query<JsonObject>(
            'SELECT * FROM idea_sessions ORDER BY created_at DESC'
        );
        return result.rows.map((row) => this.mapRowToSession(row));
    }

    async updateSessionStatus(id: string, status: IdeaSessionStatus): Promise<void> {
        const stmt = this.db.prepare(
            'UPDATE idea_sessions SET status = ?, updated_at = ? WHERE id = ?'
        );
        await stmt.run(status, Date.now(), id);
    }

    async updateSessionResearchData(id: string, researchData: ResearchData): Promise<void> {
        const stmt = this.db.prepare(
            'UPDATE idea_sessions SET research_data = ?, updated_at = ? WHERE id = ?'
        );
        await stmt.run(JSON.stringify(researchData), Date.now(), id);
    }

    async incrementIdeasGenerated(id: string): Promise<void> {
        const stmt = this.db.prepare(
            'UPDATE idea_sessions SET ideas_generated = ideas_generated + 1, updated_at = ? WHERE id = ?'
        );
        await stmt.run(Date.now(), id);
    }

    async deleteSession(id: string): Promise<void> {
        const stmt = this.db.prepare('DELETE FROM idea_sessions WHERE id = ?');
        await stmt.run(id);
    }

    // ==================== Idea Operations ====================

    async saveIdea(idea: ProjectIdea): Promise<void> {
        const stmt = this.db.prepare(
            `INSERT OR REPLACE INTO project_ideas (
                id, session_id, title, category, description, explanation,
                value_proposition, long_description, name_suggestions,
                competitive_advantages, roadmap, tech_stack, idea_competitors,
                market_research, generation_stage, research_context, status,
                project_id, logo_path, metadata, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        await stmt.run(
            idea.id,
            idea.sessionId,
            idea.title,
            idea.category,
            idea.description,
            idea.explanation ?? null,
            idea.valueProposition ?? null,
            idea.longDescription ?? null,
            idea.nameSuggestions ? JSON.stringify(idea.nameSuggestions) : null,
            idea.competitiveAdvantages ? JSON.stringify(idea.competitiveAdvantages) : null,
            idea.roadmap ? JSON.stringify(idea.roadmap) : null,
            idea.techStack ? JSON.stringify(idea.techStack) : null,
            idea.ideaCompetitors ? JSON.stringify(idea.ideaCompetitors) : null,
            idea.marketResearch ? JSON.stringify(idea.marketResearch) : null,
            idea.generationStage ?? 'complete',
            idea.researchContext ?? null,
            idea.status,
            idea.projectId ?? null,
            idea.logoPath ?? null,
            JSON.stringify(idea.metadata ?? {}),
            idea.createdAt,
            idea.updatedAt,
        );
    }

    async getIdea(id: string): Promise<ProjectIdea | null> {
        const result = await this.db.query<JsonObject>(
            'SELECT * FROM project_ideas WHERE id = ?',
            [id]
        );
        return result.rows.length > 0 ? this.mapRowToIdea(result.rows[0]) : null;
    }

    async getIdeas(sessionId?: string): Promise<ProjectIdea[]> {
        const query = sessionId
            ? 'SELECT * FROM project_ideas WHERE session_id = ? ORDER BY created_at DESC'
            : 'SELECT * FROM project_ideas ORDER BY created_at DESC';
        const params = sessionId ? [sessionId] : [];

        const result = await this.db.query<JsonObject>(query, params);
        return result.rows.map((row) => this.mapRowToIdea(row));
    }

    async updateIdeaStatus(id: string, status: IdeaStatus): Promise<void> {
        const stmt = this.db.prepare('UPDATE project_ideas SET status = ?, updated_at = ? WHERE id = ?');
        await stmt.run(status, Date.now(), id);
    }

    async deleteIdea(id: string): Promise<void> {
        const stmt = this.db.prepare('DELETE FROM project_ideas WHERE id = ?');
        await stmt.run(id);
    }

    async archiveIdea(id: string): Promise<void> {
        const stmt = this.db.prepare('UPDATE project_ideas SET status = ?, updated_at = ? WHERE id = ?');
        await stmt.run('archived', Date.now(), id);
    }

    async restoreIdea(id: string): Promise<void> {
        const stmt = this.db.prepare('UPDATE project_ideas SET status = ?, updated_at = ? WHERE id = ?');
        await stmt.run('pending', Date.now(), id);
    }

    async getArchivedIdeas(sessionId?: string): Promise<ProjectIdea[]> {
        const query = sessionId
            ? "SELECT * FROM project_ideas WHERE session_id = ? AND status = 'archived' ORDER BY created_at DESC"
            : "SELECT * FROM project_ideas WHERE status = 'archived' ORDER BY created_at DESC";
        const params = sessionId ? [sessionId] : [];

        const result = await this.db.query<JsonObject>(query, params);
        return result.rows.map((row) => this.mapRowToIdea(row));
    }

    async getIdeasByStatus(status: IdeaStatus): Promise<ProjectIdea[]> {
        const result = await this.db.query<JsonObject>(
            'SELECT * FROM project_ideas WHERE status = ? ORDER BY created_at DESC',
            [status]
        );
        return result.rows.map((row) => this.mapRowToIdea(row));
    }

    // ==================== Table Operations ====================

    async ensureTables(): Promise<void> {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS idea_sessions (
                id TEXT PRIMARY KEY,
                model TEXT NOT NULL,
                provider TEXT NOT NULL,
                categories TEXT NOT NULL,
                max_ideas INTEGER NOT NULL,
                ideas_generated INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL,
                research_data TEXT,
                custom_prompt TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `);

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS project_ideas (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                explanation TEXT,
                value_proposition TEXT,
                long_description TEXT,
                name_suggestions TEXT,
                competitive_advantages TEXT,
                roadmap TEXT,
                tech_stack TEXT,
                idea_competitors TEXT,
                market_research TEXT,
                generation_stage TEXT NOT NULL DEFAULT 'complete',
                research_context TEXT,
                status TEXT NOT NULL,
                project_id TEXT,
                logo_path TEXT,
                metadata TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (session_id) REFERENCES idea_sessions(id)
            )
        `);

        // Create indexes
        await this.db.exec(
            'CREATE INDEX IF NOT EXISTS idx_project_ideas_session_id ON project_ideas(session_id)'
        );
        await this.db.exec(
            'CREATE INDEX IF NOT EXISTS idx_project_ideas_status ON project_ideas(status)'
        );
    }

    // ==================== Row Mapping ====================

    private mapRowToSession(row: JsonObject): IdeaSession {
        return {
            id: String(row.id),
            model: String(row.model),
            provider: String(row.provider),
            categories: safeJsonParse(row.categories as string, []) as IdeaCategory[],
            maxIdeas: Number(row.max_ideas),
            ideasGenerated: Number(row.ideas_generated),
            status: String(row.status) as IdeaSessionStatus,
            researchData: row.research_data
                ? safeJsonParse(row.research_data as string, {} as ResearchData)
                : undefined,
            customPrompt: row.custom_prompt ? String(row.custom_prompt) : undefined,
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at),
        };
    }

    private mapRowToIdea(row: JsonObject): ProjectIdea {
        return {
            id: String(row.id),
            sessionId: String(row.session_id),
            title: String(row.title),
            category: String(row.category) as IdeaCategory,
            description: String(row.description ?? ''),
            explanation: row.explanation as string | undefined,
            valueProposition: row.value_proposition as string | undefined,
            longDescription: row.long_description as string | undefined,
            nameSuggestions: row.name_suggestions
                ? (safeJsonParse(row.name_suggestions as string, []) as string[])
                : undefined,
            competitiveAdvantages: row.competitive_advantages
                ? (safeJsonParse(row.competitive_advantages as string, []) as string[])
                : undefined,
            roadmap: row.roadmap
                ? (safeJsonParse(row.roadmap as string, undefined) as ProjectRoadmap | undefined)
                : undefined,
            techStack: row.tech_stack
                ? (safeJsonParse(row.tech_stack as string, undefined) as TechStack | undefined)
                : undefined,
            ideaCompetitors: row.idea_competitors
                ? (safeJsonParse(row.idea_competitors as string, []) as IdeaCompetitor[])
                : undefined,
            marketResearch: row.market_research
                ? safeJsonParse(row.market_research as string, undefined)
                : undefined,
            generationStage: row.generation_stage
                ? (row.generation_stage as IdeaGenerationStage)
                : 'complete',
            researchContext: row.research_context as string | undefined,
            status: String(row.status) as IdeaStatus,
            projectId: row.project_id as string | undefined,
            logoPath: row.logo_path as string | undefined,
            metadata: safeJsonParse(row.metadata as string, {}),
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at),
        };
    }
}
