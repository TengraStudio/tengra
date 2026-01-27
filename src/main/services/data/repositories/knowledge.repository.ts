import { JsonObject } from '@shared/types/common';
import { DatabaseAdapter } from '@shared/types/database';

import { CodeSymbolRecord, CodeSymbolSearchResult, EntityKnowledge, EpisodicMemory, SemanticFragment } from '../database.service';

import { BaseRepository } from './base.repository';

export class KnowledgeRepository extends BaseRepository {
    constructor(adapter: DatabaseAdapter) {
        super(adapter);
    }

    // --- Code Symbols ---
    async findCodeSymbolsByName(projectPath: string, name: string): Promise<CodeSymbolSearchResult[]> {
        const rows = await this.adapter.prepare("SELECT * FROM code_symbols WHERE project_path = ? AND name LIKE ? COLLATE NOCASE LIMIT 50").all<JsonObject>(projectPath, `%${name}%`);
        return rows.map(r => ({
            id: String(r.id),
            name: String(r.name),
            path: String(r.file_path ?? ''),
            line: Number(r.line ?? 0),
            kind: String(r.kind ?? ''),
            signature: String(r.signature ?? ''),
            docstring: String(r.docstring ?? ''),
            score: 0.9
        }));
    }

    async searchCodeSymbols(vector: number[]): Promise<CodeSymbolSearchResult[]> {
        const k = 10;
        const vecStr = `[${vector.join(',')}]`;
        const rows = await this.adapter.prepare(`
            SELECT *, embedding <-> $1 as distance 
            FROM code_symbols 
            ORDER BY embedding <-> $1 
            LIMIT ${k}
        `).all<JsonObject & { distance?: number }>(vecStr);

        return rows.map(r => ({
            id: String(r.id),
            name: String(r.name),
            path: String(r.file_path ?? ''),
            line: Number(r.line ?? 0),
            kind: String(r.kind ?? ''),
            signature: String(r.signature ?? ''),
            docstring: String(r.docstring ?? ''),
            score: 1 - (r.distance ?? 0)
        }));
    }

    async storeCodeSymbol(symbol: CodeSymbolRecord) {
        const vec = symbol.vector ? `[${symbol.vector.join(',')}]` : null;
        await this.adapter.prepare(`
            INSERT INTO code_symbols(id, name, project_path, file_path, line, kind, signature, docstring, embedding)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(symbol.id, symbol.name, symbol.project_path, symbol.file_path, symbol.line, symbol.kind, symbol.signature, symbol.docstring, vec);
    }

    async clearCodeSymbols(projectPath: string) {
        await this.adapter.prepare('DELETE FROM code_symbols WHERE project_path = ?').run(projectPath);
    }

    async deleteCodeSymbolsForFile(projectPath: string, filePath: string) {
        await this.adapter.prepare('DELETE FROM code_symbols WHERE project_path = ? AND file_path = ?').run(projectPath, filePath);
    }

    async searchCodeContentByText(projectPath: string, query: string): Promise<CodeSymbolSearchResult[]> {
        const rows = await this.adapter.prepare("SELECT * FROM code_symbols WHERE project_path = ? AND (docstring LIKE ? COLLATE NOCASE OR name LIKE ? COLLATE NOCASE) LIMIT 100").all<JsonObject>(projectPath, `%${query}%`, `%${query}%`);
        return rows.map(r => ({
            id: String(r.id),
            name: String(r.name),
            path: String(r.file_path ?? ''),
            line: Number(r.line ?? 0),
            kind: String(r.kind ?? ''),
            signature: String(r.signature ?? ''),
            docstring: String(r.docstring ?? ''),
            score: 0.8
        }));
    }

    // --- Semantic Fragments ---
    async storeSemanticFragment(fragment: SemanticFragment) {
        const vec = fragment.embedding.length > 0 ? `[${fragment.embedding.join(',')}]` : null;
        await this.adapter.prepare(`
            INSERT INTO semantic_fragments(id, content, embedding, source, source_id, tags, importance, project_path, created_at, updated_at)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(fragment.id, fragment.content, vec, fragment.source, fragment.sourceId, JSON.stringify(fragment.tags), fragment.importance, fragment.projectPath, fragment.createdAt, fragment.updatedAt);
    }

    async searchSemanticFragments(vector: number[], limit: number): Promise<SemanticFragment[]> {
        const vecStr = `[${vector.join(',')}]`;
        const rows = await this.adapter.prepare(`
            SELECT *, embedding <-> $1 as distance 
            FROM semantic_fragments 
            ORDER BY embedding <-> $1 
            LIMIT ${limit}
        `).all<JsonObject & { distance?: number }>(vecStr);

        return rows.map(r => this.mapRowToFragment(r, 1 - (r.distance ?? 0)));
    }

    async searchSemanticFragmentsByText(projectPath: string, query: string): Promise<SemanticFragment[]> {
        const rows = await this.adapter.prepare("SELECT * FROM semantic_fragments WHERE project_path = ? AND content LIKE ? COLLATE NOCASE LIMIT 100").all<JsonObject>(projectPath, `%${query}%`);
        return rows.map(r => this.mapRowToFragment(r));
    }

    async getSemanticFragmentsByIds(ids: string[]): Promise<SemanticFragment[]> {
        if (ids.length === 0) { return []; }
        const placeholders = ids.map(() => '?').join(',');
        const rows = await this.adapter.prepare(`SELECT * FROM semantic_fragments WHERE id IN (${placeholders})`).all<JsonObject>(...ids);
        return rows.map(r => this.mapRowToFragment(r));
    }

    async getAllSemanticFragments(): Promise<SemanticFragment[]> {
        const rows = await this.adapter.prepare('SELECT * FROM semantic_fragments ORDER BY created_at DESC').all<JsonObject>();
        return rows.map(r => this.mapRowToFragment(r));
    }

    async clearSemanticFragments(projectPath: string) {
        await this.adapter.prepare('DELETE FROM semantic_fragments WHERE project_path = ?').run(projectPath);
    }

    async deleteSemanticFragmentsForFile(projectPath: string, filePath: string) {
        await this.adapter.prepare('DELETE FROM semantic_fragments WHERE project_path = ? AND source = ?').run(projectPath, filePath);
    }

    async deleteSemanticFragment(id: string) {
        await this.adapter.prepare('DELETE FROM semantic_fragments WHERE id = ?').run(id);
    }

    private mapRowToFragment(r: JsonObject, score?: number): SemanticFragment {
        return {
            id: String(r.id),
            content: String(r.content),
            embedding: [],
            source: String(r.source),
            sourceId: String(r.source_id),
            tags: this.parseJsonField(r.tags as string | null, []),
            importance: Number(r.importance ?? 0),
            projectPath: r.project_path as string | undefined,
            createdAt: Number(r.created_at ?? r.createdAt),
            updatedAt: Number(r.updated_at ?? r.updatedAt),
            ...(score !== undefined ? { score } : {})
        };
    }

    // --- Episodic Memory ---
    async storeEpisodicMemory(memory: EpisodicMemory) {
        const vec = memory.embedding.length > 0 ? `[${memory.embedding.join(',')}]` : null;
        await this.adapter.prepare(`
            INSERT INTO episodic_memories(id, title, summary, embedding, start_date, end_date, chat_id, participants, created_at, metadata)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(memory.id, memory.title, memory.summary, vec, memory.startDate, memory.endDate, memory.chatId, JSON.stringify(memory.participants), memory.createdAt, JSON.stringify(memory.metadata ?? {}));
    }

    async searchEpisodicMemories(embedding: number[], limit: number): Promise<EpisodicMemory[]> {
        const vecStr = embedding.length > 0 ? `[${embedding.join(',')}]` : null;
        if (!vecStr) {
            const rows = await this.adapter.prepare('SELECT * FROM episodic_memories ORDER BY created_at DESC LIMIT ?').all<JsonObject>(limit);
            return rows.map(r => this.mapRowToMemory(r));
        }
        const rows = await this.adapter.prepare(`
            SELECT *, embedding <-> $1 as distance 
            FROM episodic_memories 
            ORDER BY embedding <-> $1 
            LIMIT ${limit}
        `).all<JsonObject & { distance?: number }>(vecStr);

        return rows.map(r => this.mapRowToMemory(r, 1 - (r.distance ?? 0)));
    }

    async searchEpisodicMemoriesByText(query: string): Promise<EpisodicMemory[]> {
        const rows = await this.adapter.prepare("SELECT * FROM episodic_memories WHERE title LIKE ? COLLATE NOCASE OR summary LIKE ? COLLATE NOCASE LIMIT 100").all<JsonObject>(`%${query}%`, `%${query}%`);
        return rows.map(r => this.mapRowToMemory(r));
    }

    async getEpisodicMemoriesByIds(ids: string[]): Promise<EpisodicMemory[]> {
        if (ids.length === 0) { return []; }
        const placeholders = ids.map(() => '?').join(',');
        const rows = await this.adapter.prepare(`SELECT * FROM episodic_memories WHERE id IN (${placeholders})`).all<JsonObject>(...ids);
        return rows.map(r => this.mapRowToMemory(r));
    }

    async getAllEpisodicMemories(): Promise<EpisodicMemory[]> {
        const rows = await this.adapter.prepare('SELECT * FROM episodic_memories ORDER BY created_at DESC').all<JsonObject>();
        return rows.map(r => this.mapRowToMemory(r));
    }

    private mapRowToMemory(r: JsonObject, score?: number): EpisodicMemory {
        return {
            id: String(r.id),
            title: String(r.title),
            summary: String(r.summary),
            embedding: [],
            startDate: Number(r.start_date),
            endDate: Number(r.end_date),
            chatId: String(r.chat_id),
            participants: this.parseJsonField(r.participants as string | null, []),
            createdAt: Number(r.created_at),
            timestamp: Number(r.timestamp ?? r.created_at),
            metadata: this.parseJsonField(r.metadata as string | null, {}),
            ...(score !== undefined ? { score } : {})
        };
    }

    // --- Entity Knowledge ---
    async storeEntityKnowledge(knowledge: EntityKnowledge) {
        await this.adapter.prepare(`
            INSERT INTO entity_knowledge(id, entity_type, entity_name, key, value, confidence, source, updated_at)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET value = excluded.value, confidence = excluded.confidence, updated_at = excluded.updated_at
        `).run(knowledge.id, knowledge.entityType, knowledge.entityName, knowledge.key, knowledge.value, knowledge.confidence, knowledge.source, knowledge.updatedAt);
    }

    async getEntityKnowledge(entityName: string): Promise<EntityKnowledge[]> {
        const rows = await this.adapter.prepare('SELECT * FROM entity_knowledge WHERE entity_name = ?').all<JsonObject>(entityName);
        return rows.map(r => this.mapRowToEntity(r));
    }

    async getAllEntityKnowledge(): Promise<EntityKnowledge[]> {
        const rows = await this.adapter.prepare('SELECT * FROM entity_knowledge').all<JsonObject>();
        return rows.map(r => this.mapRowToEntity(r));
    }

    async deleteEntityKnowledge(entityName: string) {
        await this.adapter.prepare('DELETE FROM entity_knowledge WHERE entity_name = ?').run(entityName);
    }

    private mapRowToEntity(r: JsonObject): EntityKnowledge {
        return {
            id: String(r.id),
            entityType: String(r.entity_type),
            entityName: String(r.entity_name),
            key: String(r.key),
            value: String(r.value),
            confidence: Number(r.confidence ?? 0),
            source: String(r.source),
            updatedAt: Number(r.updated_at)
        };
    }

    // --- File Diffs ---
    async getFileDiff(id: string) {
        return this.adapter.prepare('SELECT * FROM file_diffs WHERE id = ?').get<JsonObject>(id);
    }

    async storeFileDiff(diff: { id: string; projectId: string; filePath: string; diffContent: string; createdAt: number; sessionId?: string; systemId?: string }) {
        await this.adapter.prepare(`
            INSERT INTO file_diffs(id, project_path, file_path, diff, created_at)
            VALUES(?, ?, ?, ?, ?)
        `).run(diff.id, diff.projectId, diff.filePath, JSON.stringify(diff), Date.now());
    }

    async getFileDiffHistory(filePath: string) {
        return this.adapter.prepare('SELECT * FROM file_diffs WHERE file_path = ? ORDER BY created_at DESC').all<JsonObject>(filePath);
    }

    async getRecentFileDiffs(limit: number) {
        return this.adapter.prepare('SELECT * FROM file_diffs ORDER BY created_at DESC LIMIT ?').all<JsonObject>(limit);
    }

    async getFileDiffsBySession(sessionId: string) {
        return this.adapter.prepare('SELECT * FROM file_diffs WHERE session_id = ?').all<JsonObject>(sessionId);
    }

    async getFileDiffsBySystem(systemId: string) {
        return this.adapter.prepare('SELECT * FROM file_diffs WHERE system_id = ?').all<JsonObject>(systemId);
    }

    async cleanupOldFileDiffs(before: number) {
        await this.adapter.prepare('DELETE FROM file_diffs WHERE created_at < ?').run(before);
    }

    async ensureFileDiffTable() {
        await this.adapter.exec(`
            CREATE TABLE IF NOT EXISTS file_diffs (
                id TEXT PRIMARY KEY,
                project_path TEXT,
                file_path TEXT NOT NULL,
                diff TEXT NOT NULL,
                created_at BIGINT NOT NULL,
                session_id TEXT,
                system_id TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_file_diffs_file_path ON file_diffs(file_path);
            CREATE INDEX IF NOT EXISTS idx_file_diffs_created_at ON file_diffs(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_file_diffs_session ON file_diffs(session_id);
        `);
    }
}
