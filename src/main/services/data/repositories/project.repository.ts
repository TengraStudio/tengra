import * as fs from 'fs';

import { appLogger } from '@main/logging/logger';
import { JsonObject } from '@shared/types/common';
import { DatabaseAdapter,SqlValue } from '@shared/types/database';
import { Project } from '@shared/types/project';
import { v4 as uuidv4 } from 'uuid';

import { BaseRepository } from './base.repository';

export class ProjectRepository extends BaseRepository {
    constructor(adapter: DatabaseAdapter) {
        super(adapter);
    }

    async getProjects(): Promise<Project[]> {
        const rows = await this.adapter.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all<JsonObject>();
        return rows.map(r => this.mapRowToProject(r));
    }

    async getProject(id: string): Promise<Project | undefined> {
        const row = await this.adapter.prepare('SELECT * FROM projects WHERE id = ?').get<JsonObject>(id);
        return row ? this.mapRowToProject(row) : undefined;
    }

    async hasIndexedSymbols(projectId: string): Promise<boolean> {
        const row = await this.adapter.prepare('SELECT count(*) as count FROM code_symbols WHERE project_path = ?').get<{ count: number }>(projectId);
        return (row?.count ?? 0) > 0;
    }

    async createProject(title: string, projectPath: string, description: string = '', mountsJson?: string, councilConfigJson?: string): Promise<Project> {
        const id = uuidv4();
        const now = Date.now();
        const mounts = mountsJson ?? '[]';
        const chatIds = '[]';
        const councilConfig = councilConfigJson ?? JSON.stringify({ enabled: false, members: [], consensusThreshold: 0.7 });
        const status = 'active';
        const metadata = '{}';

        await this.adapter.prepare(`
            INSERT INTO projects(id, title, description, path, mounts, chat_ids, council_config, status, metadata, created_at, updated_at) 
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, title, description, projectPath, mounts, chatIds, councilConfig, status, metadata, now, now);

        return this.mapRowToProject({
            id, title, description, path: projectPath, mounts, chat_ids: chatIds,
            council_config: councilConfig, status, metadata, created_at: now, updated_at: now
        });
    }

    async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
        const fields: string[] = [];
        const values: unknown[] = [];

        this.collectProjectUpdates(updates, fields, values);

        if (fields.length === 0) {
            return this.getProject(id);
        }

        fields.push('updated_at = ?');
        values.push(Date.now());
        values.push(id);

        await this.adapter.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ? `).run(...(values as SqlValue[]));
        return this.getProject(id);
    }

    private collectProjectUpdates(updates: Partial<Project>, fields: string[], values: unknown[]) {
        if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
        if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
        if (updates.path !== undefined) { fields.push('path = ?'); values.push(updates.path); }
        if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
        if (updates.logo !== undefined) { fields.push('logo = ?'); values.push(updates.logo); }
        if (updates.mounts !== undefined) { fields.push('mounts = ?'); values.push(JSON.stringify(updates.mounts)); }
        if (updates.chatIds !== undefined) { fields.push('chat_ids = ?'); values.push(JSON.stringify(updates.chatIds)); }
        if (updates.councilConfig !== undefined) { fields.push('council_config = ?'); values.push(JSON.stringify(updates.councilConfig)); }
        if (updates.metadata !== undefined) { fields.push('metadata = ?'); values.push(JSON.stringify(updates.metadata)); }
    }

    async deleteProject(id: string, deleteFiles: boolean = false): Promise<void> {
        if (deleteFiles) {
            const project = await this.getProject(id);
            if (project?.path && fs.existsSync(project.path)) {
                try {
                    await fs.promises.rm(project.path, { recursive: true, force: true });
                } catch (error) {
                    appLogger.error('ProjectRepository', `Failed to delete project files at ${project.path}`, error as Error);
                }
            }
        }
        await this.adapter.prepare('DELETE FROM projects WHERE id = ?').run(id);
    }

    private mapRowToProject(row: JsonObject): Project {
        return {
            id: String(row.id),
            title: String(row.title),
            description: (row.description as string | null) ?? '',
            path: String(row.path),
            mounts: (this.parseJsonField(row.mounts as string, []) as Array<{ id?: string; name: string; type: 'local' | 'ssh'; path?: string; rootPath?: string }>).map(m => ({
                id: m.id ?? uuidv4(),
                name: m.name ?? 'Untitled Mount',
                type: (m.type as 'local' | 'ssh') ?? 'local',
                rootPath: m.rootPath ?? m.path ?? ''
            })),
            chatIds: this.parseJsonField(row.chat_ids as string, []),
            councilConfig: this.parseJsonField(row.council_config as string, { enabled: false, members: [], consensusThreshold: 0.7 }),
            status: (String(row.status) as 'active' | 'archived' | 'draft') || 'active',
            logo: row.logo as string | undefined,
            metadata: this.parseJsonField(row.metadata as string, {}),
            createdAt: Number(row.created_at ?? row.createdAt ?? Date.now()),
            updatedAt: Number(row.updated_at ?? row.updatedAt ?? Date.now())
        };
    }
}
