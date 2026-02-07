import { appLogger } from '@main/logging/logger';
import {
    AdvancedSemanticFragment,
    ContradictionCandidate,
    MemoryCategory,
    MemorySource,
    MemoryStatus,
    PendingMemory,
    SimilarMemoryCandidate
} from '@shared/types/advanced-memory';
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
        // Sanitize LIKE pattern to prevent wildcard injection
        const sanitizedName = name.replace(/[%_]/g, '\\$&');
        const rows = await this.adapter.prepare("SELECT * FROM code_symbols WHERE project_path = ? AND name LIKE ? ESCAPE '\\' COLLATE NOCASE LIMIT 50").all<JsonObject>(projectPath, `%${sanitizedName}%`);
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

    async storeCodeSymbol(symbol: CodeSymbolRecord): Promise<void> {
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
        // Sanitize LIKE pattern to prevent wildcard injection
        const sanitizedQuery = query.replace(/[%_]/g, '\\$&');
        const rows = await this.adapter.prepare("SELECT * FROM code_symbols WHERE project_path = ? AND (docstring LIKE ? ESCAPE '\\' COLLATE NOCASE OR name LIKE ? ESCAPE '\\' COLLATE NOCASE) LIMIT 100").all<JsonObject>(projectPath, `%${sanitizedQuery}%`, `%${sanitizedQuery}%`);
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
        // Sanitize LIKE pattern to prevent wildcard injection
        const sanitizedQuery = query.replace(/[%_]/g, '\\$&');
        const rows = await this.adapter.prepare("SELECT * FROM semantic_fragments WHERE project_path = ? AND content LIKE ? ESCAPE '\\' COLLATE NOCASE LIMIT 100").all<JsonObject>(projectPath, `%${sanitizedQuery}%`);
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
    async getFileDiff(id: string): Promise<JsonObject | undefined> {
        return this.adapter.prepare('SELECT * FROM file_diffs WHERE id = ?').get<JsonObject>(id);
    }

    async storeFileDiff(diff: { id: string; projectId: string; filePath: string; diffContent: string; createdAt: number; sessionId?: string; systemId?: string }): Promise<void> {
        await this.adapter.prepare(`
            INSERT INTO file_diffs(id, project_path, file_path, diff, created_at)
            VALUES(?, ?, ?, ?, ?)
        `).run(diff.id, diff.projectId, diff.filePath, JSON.stringify(diff), Date.now());
    }

    async getFileDiffHistory(filePath: string): Promise<JsonObject[]> {
        return this.adapter.prepare('SELECT * FROM file_diffs WHERE file_path = ? ORDER BY created_at DESC').all<JsonObject>(filePath);
    }

    async getRecentFileDiffs(limit: number): Promise<JsonObject[]> {
        return this.adapter.prepare('SELECT * FROM file_diffs ORDER BY created_at DESC LIMIT ?').all<JsonObject>(limit);
    }

    async getFileDiffsBySession(sessionId: string): Promise<JsonObject[]> {
        return this.adapter.prepare('SELECT * FROM file_diffs WHERE session_id = ?').all<JsonObject>(sessionId);
    }

    async getFileDiffsBySystem(systemId: string): Promise<JsonObject[]> {
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

    // =========================================================================
    // ADVANCED MEMORY SYSTEM
    // =========================================================================

    async storeAdvancedMemory(memory: AdvancedSemanticFragment): Promise<void> {
        try {
            const vec = memory.embedding.length > 0 ? `[${memory.embedding.join(',')}]` : null;
            await this.adapter.prepare(`
                INSERT INTO advanced_memories (
                    id, content, embedding, source, source_id, source_context,
                    category, tags, confidence, importance, initial_importance,
                    status, validated_at, validated_by, access_count, last_accessed_at,
                    related_memory_ids, contradicts_ids, merged_into_id,
                    project_id, context_tags, created_at, updated_at, expires_at, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                memory.id,
                memory.content,
                vec,
                memory.source,
                memory.sourceId,
                memory.sourceContext ?? null,
                memory.category,
                JSON.stringify(memory.tags),
                memory.confidence,
                memory.importance,
                memory.initialImportance,
                memory.status,
                memory.validatedAt ?? null,
                memory.validatedBy ?? null,
                memory.accessCount,
                memory.lastAccessedAt,
                JSON.stringify(memory.relatedMemoryIds),
                JSON.stringify(memory.contradictsIds),
                memory.mergedIntoId ?? null,
                memory.projectId ?? null,
                JSON.stringify(memory.contextTags ?? []),
                memory.createdAt,
                memory.updatedAt,
                memory.expiresAt ?? null,
                JSON.stringify(memory.metadata ?? {})
            );
        } catch (error) {
            appLogger.error('KnowledgeRepository', 'Failed to store advanced memory', error as Error);
            throw error;
        }
    }

    async updateAdvancedMemory(memory: AdvancedSemanticFragment): Promise<void> {
        const vec = memory.embedding.length > 0 ? `[${memory.embedding.join(',')}]` : null;
        await this.adapter.prepare(`
            UPDATE advanced_memories SET
                content = ?, embedding = ?, source = ?, source_id = ?, source_context = ?,
                category = ?, tags = ?, confidence = ?, importance = ?, initial_importance = ?,
                status = ?, validated_at = ?, validated_by = ?, access_count = ?, last_accessed_at = ?,
                related_memory_ids = ?, contradicts_ids = ?, merged_into_id = ?,
                project_id = ?, context_tags = ?, updated_at = ?, expires_at = ?, metadata = ?
            WHERE id = ?
        `).run(
            memory.content,
            vec,
            memory.source,
            memory.sourceId,
            memory.sourceContext ?? null,
            memory.category,
            JSON.stringify(memory.tags),
            memory.confidence,
            memory.importance,
            memory.initialImportance,
            memory.status,
            memory.validatedAt ?? null,
            memory.validatedBy ?? null,
            memory.accessCount,
            memory.lastAccessedAt,
            JSON.stringify(memory.relatedMemoryIds),
            JSON.stringify(memory.contradictsIds),
            memory.mergedIntoId ?? null,
            memory.projectId ?? null,
            JSON.stringify(memory.contextTags ?? []),
            memory.updatedAt,
            memory.expiresAt ?? null,
            JSON.stringify(memory.metadata ?? {}),
            memory.id
        );
    }

    async getAdvancedMemoryById(id: string): Promise<AdvancedSemanticFragment | null> {
        const row = await this.adapter.prepare('SELECT * FROM advanced_memories WHERE id = ?').get<JsonObject>(id);
        return row ? this.mapRowToAdvancedMemory(row) : null;
    }

    async getAllAdvancedMemories(): Promise<AdvancedSemanticFragment[]> {
        const rows = await this.adapter.prepare('SELECT * FROM advanced_memories ORDER BY created_at DESC').all<JsonObject>();
        return rows.map(r => this.mapRowToAdvancedMemory(r));
    }

    async deleteAdvancedMemory(id: string): Promise<void> {
        await this.adapter.prepare('DELETE FROM advanced_memories WHERE id = ?').run(id);
    }

    async searchAdvancedMemories(embedding: number[], limit: number): Promise<AdvancedSemanticFragment[]> {
        const vecStr = `[${embedding.join(',')}]`;
        const rows = await this.adapter.prepare(`
            SELECT *, embedding <-> $1 as distance
            FROM advanced_memories
            WHERE status IN ('confirmed', 'pending')
            ORDER BY embedding <-> $1
            LIMIT ${limit}
        `).all<JsonObject & { distance?: number }>(vecStr);

        return rows.map(r => this.mapRowToAdvancedMemory(r, 1 - (r.distance ?? 0)));
    }

    private mapRowToAdvancedMemory(r: JsonObject, score?: number): AdvancedSemanticFragment {
        return {
            id: String(r.id),
            content: String(r.content),
            embedding: [],  // Don't return large embeddings by default
            source: String(r.source) as MemorySource,
            sourceId: String(r.source_id),
            sourceContext: r.source_context as string | undefined,
            category: String(r.category) as MemoryCategory,
            tags: this.parseJsonField(r.tags as string | null, []),
            confidence: Number(r.confidence ?? 0),
            importance: Number(r.importance ?? 0),
            initialImportance: Number(r.initial_importance ?? r.importance ?? 0),
            status: String(r.status) as MemoryStatus,
            validatedAt: r.validated_at ? Number(r.validated_at) : undefined,
            validatedBy: r.validated_by as 'user' | 'auto' | 'system' | undefined,
            accessCount: Number(r.access_count ?? 0),
            lastAccessedAt: Number(r.last_accessed_at ?? r.created_at),
            relatedMemoryIds: this.parseJsonField(r.related_memory_ids as string | null, []),
            contradictsIds: this.parseJsonField(r.contradicts_ids as string | null, []),
            mergedIntoId: r.merged_into_id as string | undefined,
            projectId: r.project_id as string | undefined,
            contextTags: this.parseJsonField(r.context_tags as string | null, []),
            createdAt: Number(r.created_at),
            updatedAt: Number(r.updated_at),
            expiresAt: r.expires_at ? Number(r.expires_at) : undefined,
            metadata: this.parseJsonField(r.metadata as string | null, {}),
            ...(score !== undefined ? { score } : {})
        };
    }

    // --- Pending Memories ---

    async savePendingMemory(pending: PendingMemory): Promise<void> {
        const vec = pending.embedding.length > 0 ? `[${pending.embedding.join(',')}]` : null;
        await this.adapter.prepare(`
            INSERT INTO pending_memories (
                id, content, embedding, source, source_id, source_context, extracted_at,
                suggested_category, suggested_tags, extraction_confidence, relevance_score,
                novelty_score, requires_user_validation, auto_confirm_reason,
                potential_contradictions, similar_memories, project_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                content = excluded.content,
                suggested_category = excluded.suggested_category,
                suggested_tags = excluded.suggested_tags,
                extraction_confidence = excluded.extraction_confidence,
                relevance_score = excluded.relevance_score,
                novelty_score = excluded.novelty_score,
                requires_user_validation = excluded.requires_user_validation,
                potential_contradictions = excluded.potential_contradictions,
                similar_memories = excluded.similar_memories
        `).run(
            pending.id,
            pending.content,
            vec,
            pending.source,
            pending.sourceId,
            pending.sourceContext,
            pending.extractedAt,
            pending.suggestedCategory,
            JSON.stringify(pending.suggestedTags),
            pending.extractionConfidence,
            pending.relevanceScore,
            pending.noveltyScore,
            pending.requiresUserValidation ? 1 : 0,
            pending.autoConfirmReason ?? null,
            JSON.stringify(pending.potentialContradictions),
            JSON.stringify(pending.similarMemories),
            pending.projectId ?? null
        );
    }

    async deletePendingMemory(id: string): Promise<void> {
        await this.adapter.prepare('DELETE FROM pending_memories WHERE id = ?').run(id);
    }

    async getAllPendingMemories(): Promise<PendingMemory[]> {
        const rows = await this.adapter.prepare('SELECT * FROM pending_memories ORDER BY extracted_at DESC').all<JsonObject>();
        return rows.map(r => this.mapRowToPendingMemory(r));
    }

    private mapRowToPendingMemory(r: JsonObject): PendingMemory {
        return {
            id: String(r.id),
            content: String(r.content),
            embedding: [],  // Don't return large embeddings
            source: String(r.source) as MemorySource,
            sourceId: String(r.source_id),
            sourceContext: String(r.source_context),
            extractedAt: Number(r.extracted_at),
            suggestedCategory: String(r.suggested_category) as MemoryCategory,
            suggestedTags: this.parseJsonField(r.suggested_tags as string | null, []),
            extractionConfidence: Number(r.extraction_confidence ?? 0),
            relevanceScore: Number(r.relevance_score ?? 0),
            noveltyScore: Number(r.novelty_score ?? 0),
            requiresUserValidation: Boolean(r.requires_user_validation),
            autoConfirmReason: r.auto_confirm_reason as string | undefined,
            potentialContradictions: this.parseJsonField<ContradictionCandidate[]>(r.potential_contradictions as string | null, []),
            similarMemories: this.parseJsonField<SimilarMemoryCandidate[]>(r.similar_memories as string | null, []),
            projectId: r.project_id as string | undefined
        };
    }

    // =========================================================================
    // CLEAN-001-4: Orphaned Data Cleanup
    // =========================================================================

    /**
     * CLEAN-001-4: Clean up all knowledge data associated with a deleted project
     * Should be called when a project is deleted to prevent orphaned data
     */
    async cleanupProjectData(projectPath: string): Promise<{ deletedCounts: Record<string, number> }> {
        const deletedCounts: Record<string, number> = {};

        try {
            // Clean up code symbols
            const codeSymbolsResult = await this.adapter.prepare(
                'DELETE FROM code_symbols WHERE project_path = ?'
            ).run(projectPath);
            deletedCounts.codeSymbols = codeSymbolsResult.rowsAffected ?? 0;

            // Clean up semantic fragments
            const fragmentsResult = await this.adapter.prepare(
                'DELETE FROM semantic_fragments WHERE project_path = ?'
            ).run(projectPath);
            deletedCounts.semanticFragments = fragmentsResult.rowsAffected ?? 0;

            // Clean up file diffs
            const diffsResult = await this.adapter.prepare(
                'DELETE FROM file_diffs WHERE project_path = ?'
            ).run(projectPath);
            deletedCounts.fileDiffs = diffsResult.rowsAffected ?? 0;

            // Clean up advanced memories
            const memoriesResult = await this.adapter.prepare(
                'DELETE FROM advanced_memories WHERE project_id = ?'
            ).run(projectPath);
            deletedCounts.advancedMemories = memoriesResult.rowsAffected ?? 0;

            // Clean up pending memories
            const pendingResult = await this.adapter.prepare(
                'DELETE FROM pending_memories WHERE project_id = ?'
            ).run(projectPath);
            deletedCounts.pendingMemories = pendingResult.rowsAffected ?? 0;

            appLogger.info('KnowledgeRepository', `Cleaned up orphaned data for project ${projectPath}`, deletedCounts as unknown as JsonObject);
            return { deletedCounts };
        } catch (error) {
            appLogger.error('KnowledgeRepository', `Failed to cleanup project data for ${projectPath}`, error as Error);
            throw error;
        }
    }

    /**
     * CLEAN-001-4: Clean up episodic memories associated with a deleted chat
     */
    async cleanupChatData(chatId: string): Promise<number> {
        try {
            const result = await this.adapter.prepare(
                'DELETE FROM episodic_memories WHERE chat_id = ?'
            ).run(chatId);
            const deletedCount = result.rowsAffected ?? 0;

            if (deletedCount > 0) {
                appLogger.info('KnowledgeRepository', `Cleaned up ${deletedCount} episodic memories for chat ${chatId}`);
            }
            return deletedCount;
        } catch (error) {
            appLogger.error('KnowledgeRepository', `Failed to cleanup chat data for ${chatId}`, error as Error);
            throw error;
        }
    }

    /**
     * CLEAN-001-4: Find and clean up orphaned data (data referencing non-existent projects/chats)
     * This is a maintenance operation that should be run periodically
     * @param existingProjectPaths - List of currently existing project paths
     * @param existingChatIds - List of currently existing chat IDs
     */
    async cleanupOrphanedData(
        existingProjectPaths: string[],
        existingChatIds: string[]
    ): Promise<{ orphanedCounts: Record<string, number> }> {
        const orphanedCounts: Record<string, number> = {};

        try {
            // If we have no existing projects, don't delete everything - that's probably an error
            if (existingProjectPaths.length === 0) {
                appLogger.warn('KnowledgeRepository', 'No existing projects provided, skipping project orphan cleanup');
            } else {
                const projectPlaceholders = existingProjectPaths.map(() => '?').join(',');

                // Clean orphaned code symbols
                const codeResult = await this.adapter.prepare(
                    `DELETE FROM code_symbols WHERE project_path IS NOT NULL AND project_path NOT IN (${projectPlaceholders})`
                ).run(...existingProjectPaths);
                orphanedCounts.codeSymbols = codeResult.rowsAffected ?? 0;

                // Clean orphaned semantic fragments
                const fragResult = await this.adapter.prepare(
                    `DELETE FROM semantic_fragments WHERE project_path IS NOT NULL AND project_path NOT IN (${projectPlaceholders})`
                ).run(...existingProjectPaths);
                orphanedCounts.semanticFragments = fragResult.rowsAffected ?? 0;

                // Clean orphaned file diffs
                const diffResult = await this.adapter.prepare(
                    `DELETE FROM file_diffs WHERE project_path IS NOT NULL AND project_path NOT IN (${projectPlaceholders})`
                ).run(...existingProjectPaths);
                orphanedCounts.fileDiffs = diffResult.rowsAffected ?? 0;

                // Clean orphaned advanced memories
                const memResult = await this.adapter.prepare(
                    `DELETE FROM advanced_memories WHERE project_id IS NOT NULL AND project_id NOT IN (${projectPlaceholders})`
                ).run(...existingProjectPaths);
                orphanedCounts.advancedMemories = memResult.rowsAffected ?? 0;

                // Clean orphaned pending memories
                const pendResult = await this.adapter.prepare(
                    `DELETE FROM pending_memories WHERE project_id IS NOT NULL AND project_id NOT IN (${projectPlaceholders})`
                ).run(...existingProjectPaths);
                orphanedCounts.pendingMemories = pendResult.rowsAffected ?? 0;
            }

            // Clean orphaned episodic memories
            if (existingChatIds.length === 0) {
                appLogger.warn('KnowledgeRepository', 'No existing chats provided, skipping chat orphan cleanup');
            } else {
                const chatPlaceholders = existingChatIds.map(() => '?').join(',');
                const episodicResult = await this.adapter.prepare(
                    `DELETE FROM episodic_memories WHERE chat_id IS NOT NULL AND chat_id NOT IN (${chatPlaceholders})`
                ).run(...existingChatIds);
                orphanedCounts.episodicMemories = episodicResult.rowsAffected ?? 0;
            }

            const totalOrphaned = Object.values(orphanedCounts).reduce((a, b) => a + b, 0);
            if (totalOrphaned > 0) {
                appLogger.info('KnowledgeRepository', `Cleaned up ${totalOrphaned} orphaned records`, orphanedCounts as unknown as JsonObject);
            }

            return { orphanedCounts };
        } catch (error) {
            appLogger.error('KnowledgeRepository', 'Failed to cleanup orphaned data', error as Error);
            throw error;
        }
    }
}
