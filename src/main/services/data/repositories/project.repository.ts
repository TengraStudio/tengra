import * as fs from 'fs';

import { appLogger } from '@main/logging/logger';
import { JsonObject } from '@shared/types/common';
import { DatabaseAdapter, SqlValue } from '@shared/types/database';
import { Project } from '@shared/types/project';
import { v4 as uuidv4 } from 'uuid';

import { BaseRepository } from './base.repository';

export class ProjectRepository extends BaseRepository {
    constructor(adapter: DatabaseAdapter) {
        super(adapter);
    }

    async getProjects(): Promise<Project[]> {
        const rows = await this.adapter
            .prepare('SELECT * FROM projects ORDER BY updated_at DESC')
            .all<JsonObject>();
        return rows.map(r => this.mapRowToProject(r));
    }

    async getProject(id: string): Promise<Project | undefined> {
        const row = await this.adapter
            .prepare('SELECT * FROM projects WHERE id = ?')
            .get<JsonObject>(id);
        return row ? this.mapRowToProject(row) : undefined;
    }

    async hasIndexedSymbols(projectPath: string): Promise<boolean> {
        const row = await this.adapter
            .prepare('SELECT count(*) as count FROM code_symbols WHERE project_path = ?')
            .get<{ count: number }>(projectPath);
        return (row?.count ?? 0) > 0;
    }

    async createProject(
        title: string,
        projectPath: string,
        description: string = '',
        mountsJson?: string,
        councilConfigJson?: string
    ): Promise<Project> {
        const id = uuidv4();
        const now = Date.now();
        const mounts = mountsJson ?? '[]';
        const chatIds = '[]';
        const councilConfig =
            councilConfigJson ??
            JSON.stringify({ enabled: false, members: [], consensusThreshold: 0.7 });
        const status = 'active';
        const metadata = '{}';

        await this.adapter
            .prepare(
                `
            INSERT INTO projects(id, title, description, path, mounts, chat_ids, council_config, status, metadata, created_at, updated_at) 
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
            )
            .run(
                id,
                title,
                description,
                projectPath,
                mounts,
                chatIds,
                councilConfig,
                status,
                metadata,
                now,
                now
            );

        return this.mapRowToProject({
            id,
            title,
            description,
            path: projectPath,
            mounts,
            chat_ids: chatIds,
            council_config: councilConfig,
            status,
            metadata,
            created_at: now,
            updated_at: now,
        });
    }

    async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
        const fields: string[] = [];
        const values: unknown[] = [];
        const currentProject = await this.getProject(id);

        this.collectProjectUpdates(updates, fields, values, currentProject ?? undefined);

        if (fields.length === 0) {
            return this.getProject(id);
        }

        fields.push('updated_at = ?');
        values.push(Date.now());
        values.push(id);

        await this.adapter
            .prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ? `)
            .run(...(values as SqlValue[]));
        return this.getProject(id);
    }

    private collectProjectUpdates(
        updates: Partial<Project>,
        fields: string[],
        values: unknown[],
        currentProject?: Project
    ) {
        if (updates.title !== undefined) {
            fields.push('title = ?');
            values.push(updates.title);
        }
        if (updates.description !== undefined) {
            fields.push('description = ?');
            values.push(updates.description);
        }
        if (updates.path !== undefined) {
            fields.push('path = ?');
            values.push(updates.path);
        }
        if (updates.status !== undefined) {
            fields.push('status = ?');
            values.push(updates.status);
        }
        if (updates.logo !== undefined) {
            fields.push('logo = ?');
            values.push(updates.logo);
        }
        if (updates.mounts !== undefined) {
            fields.push('mounts = ?');
            values.push(JSON.stringify(this.normalizeMounts(updates.mounts)));
        }
        if (updates.chatIds !== undefined) {
            fields.push('chat_ids = ?');
            values.push(JSON.stringify(updates.chatIds));
        }
        if (updates.councilConfig !== undefined) {
            fields.push('council_config = ?');
            values.push(JSON.stringify(updates.councilConfig));
        }
        const shouldPersistMetadata =
            updates.metadata !== undefined ||
            updates.buildConfig !== undefined ||
            updates.devServer !== undefined ||
            updates.advancedOptions !== undefined;
        if (shouldPersistMetadata) {
            const mergedMetadata = this.mergeProjectMetadata(currentProject?.metadata, updates);
            fields.push('metadata = ?');
            values.push(JSON.stringify(mergedMetadata));
        }
    }

    async deleteProject(id: string, deleteFiles: boolean = false): Promise<void> {
        if (deleteFiles) {
            const project = await this.getProject(id);
            if (project?.path && fs.existsSync(project.path)) {
                try {
                    await fs.promises.rm(project.path, { recursive: true, force: true });
                } catch (error) {
                    appLogger.error(
                        'ProjectRepository',
                        `Failed to delete project files at ${project.path}`,
                        error as Error
                    );
                }
            }
        }
        await this.adapter.prepare('DELETE FROM projects WHERE id = ?').run(id);
    }

    private mapRowToProject(row: JsonObject): Project {
        const metadata = this.parseRowJsonObjectField(row.metadata) ?? {};
        const metadataSettings = this.extractSettingsFromMetadata(metadata);
        const rowBuildConfig = this.normalizeBuildConfig(
            this.parseRowJsonObjectField(row.build_config)
        );
        const rowDevServer = this.normalizeDevServer(this.parseRowJsonObjectField(row.dev_server));
        const rowAdvancedOptions = this.normalizeAdvancedOptions(
            this.parseRowJsonObjectField(row.advanced_options)
        );
        const mounts = this.normalizeMounts(row.mounts).map(m => ({
            id: m.id ?? uuidv4(),
            name: m.name,
            type: m.type as 'local' | 'ssh',
            rootPath: m.rootPath ?? (m as { path?: string }).path ?? '',
        }));

        return {
            id: String(row.id),
            title: String(row.title),
            description: (row.description as string | null) ?? '',
            path: String(row.path),
            mounts,
            chatIds: this.normalizeStringArray(row.chat_ids),
            councilConfig: this.normalizeCouncilConfig(row.council_config),
            status: row.status as 'active' | 'archived' | 'draft',
            logo: row.logo as string | undefined,
            metadata,
            buildConfig: rowBuildConfig ?? metadataSettings.buildConfig,
            devServer: rowDevServer ?? metadataSettings.devServer,
            advancedOptions: rowAdvancedOptions ?? metadataSettings.advancedOptions,
            createdAt: Number(row.created_at ?? row.createdAt ?? Date.now()),
            updatedAt: Number(row.updated_at ?? row.updatedAt ?? Date.now()),
        };
    }

    private parseRowJsonObjectField(value: unknown): JsonObject | undefined {
        if (typeof value === 'string') {
            const parsed = this.parseJsonField(value, {});
            return this.isObject(parsed) ? (parsed as JsonObject) : undefined;
        }
        if (this.isObject(value)) {
            return value as JsonObject;
        }
        return undefined;
    }

    private normalizeMounts(value: unknown): Project['mounts'] {
        if (Array.isArray(value)) {
            return value as Project['mounts'];
        }
        if (typeof value === 'string') {
            const parsed = this.parseJsonField<unknown>(value, []);
            return Array.isArray(parsed) ? (parsed as Project['mounts']) : [];
        }
        return [];
    }

    private mergeProjectMetadata(
        currentMetadata: JsonObject | undefined,
        updates: Partial<Project>
    ): JsonObject {
        const baseMetadata: JsonObject = this.isObject(currentMetadata)
            ? { ...(currentMetadata as JsonObject) }
            : {};

        if (this.isObject(updates.metadata)) {
            Object.assign(baseMetadata, updates.metadata);
        }

        const currentSettings = this.extractSettingsFromMetadata(baseMetadata);
        const nextBuildConfig =
            updates.buildConfig !== undefined
                ? this.normalizeBuildConfig(updates.buildConfig)
                : currentSettings.buildConfig;
        const nextDevServer =
            updates.devServer !== undefined
                ? this.normalizeDevServer(updates.devServer)
                : currentSettings.devServer;
        const nextAdvancedOptions =
            updates.advancedOptions !== undefined
                ? this.normalizeAdvancedOptions(updates.advancedOptions)
                : currentSettings.advancedOptions;

        const hasProjectSettings = Boolean(nextBuildConfig ?? nextDevServer ?? nextAdvancedOptions);
        if (hasProjectSettings) {
            const projectSettings: JsonObject = {};
            if (nextBuildConfig) {
                projectSettings.buildConfig = nextBuildConfig as unknown as JsonObject;
            }
            if (nextDevServer) {
                projectSettings.devServer = nextDevServer as unknown as JsonObject;
            }
            if (nextAdvancedOptions) {
                projectSettings.advancedOptions = nextAdvancedOptions as unknown as JsonObject;
            }
            baseMetadata.projectSettings = projectSettings;
        } else {
            delete (baseMetadata as Record<string, unknown>).projectSettings;
        }

        // Remove legacy top-level keys to keep metadata shape stable.
        delete (baseMetadata as Record<string, unknown>).buildConfig;
        delete (baseMetadata as Record<string, unknown>).devServer;
        delete (baseMetadata as Record<string, unknown>).advancedOptions;

        return baseMetadata;
    }

    private extractSettingsFromMetadata(metadata?: JsonObject): {
        buildConfig?: Project['buildConfig'];
        devServer?: Project['devServer'];
        advancedOptions?: Project['advancedOptions'];
    } {
        if (!this.isObject(metadata)) {
            return {};
        }

        const settingsContainer = this.isObject(
            (metadata as Record<string, unknown>).projectSettings
        )
            ? ((metadata as Record<string, unknown>).projectSettings as Record<string, unknown>)
            : (metadata as Record<string, unknown>);

        return {
            buildConfig: this.normalizeBuildConfig(settingsContainer.buildConfig),
            devServer: this.normalizeDevServer(settingsContainer.devServer),
            advancedOptions: this.normalizeAdvancedOptions(settingsContainer.advancedOptions),
        };
    }

    private normalizeBuildConfig(value: unknown): Project['buildConfig'] | undefined {
        if (!this.isObject(value)) {
            return undefined;
        }
        const v = value as Record<string, unknown>;
        const result: Project['buildConfig'] = {
            ...(typeof v.buildCommand === 'string' ? { buildCommand: v.buildCommand } : {}),
            ...(typeof v.testCommand === 'string' ? { testCommand: v.testCommand } : {}),
            ...(typeof v.lintCommand === 'string' ? { lintCommand: v.lintCommand } : {}),
            ...(typeof v.outputDir === 'string' ? { outputDir: v.outputDir } : {}),
            ...(typeof v.envFile === 'string' ? { envFile: v.envFile } : {}),
        };
        return Object.keys(result).length > 0 ? result : undefined;
    }

    private normalizeDevServer(value: unknown): Project['devServer'] | undefined {
        if (!this.isObject(value)) {
            return undefined;
        }
        const v = value as Record<string, unknown>;
        const normalizedPort =
            typeof v.port === 'number'
                ? v.port
                : typeof v.port === 'string'
                  ? Number(v.port)
                  : undefined;
        const result: Project['devServer'] = {
            ...(typeof v.command === 'string' ? { command: v.command } : {}),
            ...(Number.isFinite(normalizedPort) ? { port: normalizedPort as number } : {}),
            ...(typeof v.autoStart === 'boolean' ? { autoStart: v.autoStart } : {}),
        };
        return Object.keys(result).length > 0 ? result : undefined;
    }

    private normalizeAdvancedOptions(value: unknown): Project['advancedOptions'] | undefined {
        if (!this.isObject(value)) {
            return undefined;
        }
        const v = value as Record<string, unknown>;
        const result: Project['advancedOptions'] = {
            ...(typeof v.fileWatchEnabled === 'boolean'
                ? { fileWatchEnabled: v.fileWatchEnabled }
                : {}),
            ...(Array.isArray(v.fileWatchIgnore)
                ? { fileWatchIgnore: v.fileWatchIgnore as string[] }
                : {}),
            ...(typeof v.indexingEnabled === 'boolean'
                ? { indexingEnabled: v.indexingEnabled }
                : {}),
            ...(typeof v.indexingInterval === 'number'
                ? { indexingInterval: v.indexingInterval }
                : {}),
            ...(typeof v.autoSave === 'boolean' ? { autoSave: v.autoSave } : {}),
        };
        return Object.keys(result).length > 0 ? result : undefined;
    }

    private normalizeStringArray(value: unknown): string[] {
        if (Array.isArray(value)) {
            return value.filter(item => typeof item === 'string') as string[];
        }
        if (typeof value === 'string') {
            const parsed = this.parseJsonField<unknown>(value, []);
            return Array.isArray(parsed)
                ? (parsed.filter(item => typeof item === 'string') as string[])
                : [];
        }
        return [];
    }

    private normalizeCouncilConfig(value: unknown): Project['councilConfig'] {
        const defaultConfig: Project['councilConfig'] = {
            enabled: false,
            members: [],
            consensusThreshold: 0.7,
        };
        let record: Record<string, unknown> | undefined;

        if (this.isObject(value)) {
            record = value as Record<string, unknown>;
        } else if (typeof value === 'string') {
            const parsed = this.parseJsonField<unknown>(value, defaultConfig as unknown);
            if (this.isObject(parsed)) {
                record = parsed as Record<string, unknown>;
            }
        }

        if (!record) {
            return defaultConfig;
        }

        return {
            enabled: typeof record.enabled === 'boolean' ? record.enabled : defaultConfig.enabled,
            members: Array.isArray(record.members)
                ? (record.members.filter(member => typeof member === 'string') as string[])
                : defaultConfig.members,
            consensusThreshold:
                typeof record.consensusThreshold === 'number'
                    ? record.consensusThreshold
                    : defaultConfig.consensusThreshold,
        };
    }

    private isObject(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
}
