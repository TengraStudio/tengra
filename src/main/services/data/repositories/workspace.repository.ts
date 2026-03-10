import * as fs from 'fs';

import { appLogger } from '@main/logging/logger';
import { WORKSPACE_COMPAT_SCHEMA_VALUES } from '@shared/constants';
import { JsonObject } from '@shared/types/common';
import { DatabaseAdapter, SqlValue } from '@shared/types/database';
import { DbWorkspace } from '@shared/types/db-api';
import { Workspace } from '@shared/types/workspace';
import { v4 as uuidv4 } from 'uuid';

import { BaseRepository } from './base.repository';

const WORKSPACE_COMPAT_PATH_COLUMN = WORKSPACE_COMPAT_SCHEMA_VALUES.PATH_COLUMN;

export class WorkspaceRepository extends BaseRepository {
    constructor(adapter: DatabaseAdapter) {
        super(adapter);
    }

    async getWorkspaces(): Promise<Workspace[]> {
        const rows = await this.selectAllPaginated<JsonObject>(`SELECT * FROM ${WORKSPACE_COMPAT_SCHEMA_VALUES.TABLE} ORDER BY updated_at DESC`);
        return rows.map(r => this.mapRowToWorkspace(r));
    }

    async getWorkspace(id: string): Promise<Workspace | undefined> {
        const row = await this.adapter
            .prepare(`SELECT * FROM ${WORKSPACE_COMPAT_SCHEMA_VALUES.TABLE} WHERE id = ?`)
            .get<JsonObject>(id);
        return row ? this.mapRowToWorkspace(row) : undefined;
    }

    async hasIndexedSymbols(workspacePath: string): Promise<boolean> {
        const row = await this.adapter
            .prepare(`SELECT count(*) as count FROM code_symbols WHERE ${WORKSPACE_COMPAT_PATH_COLUMN} = ?`)
            .get<{ count: number }>(workspacePath);
        return (row?.count ?? 0) > 0;
    }

    async createWorkspace(
        title: string,
        workspacePath: string,
        description: string = '',
        mountsJson?: string,
        councilConfigJson?: string
    ): Promise<Workspace> {
        const id = uuidv4();
        const now = Date.now();
        const mounts = mountsJson ?? '[]';
        const chatIds = '[]';
        const councilConfig =
            councilConfigJson ??
            JSON.stringify({ enabled: false, members: [], consensusThreshold: 0.7 });
        const status = 'active';
        const metadata = '{}';

        const insertResult = await this.adapter
            .prepare(
                `
            INSERT INTO ${WORKSPACE_COMPAT_SCHEMA_VALUES.TABLE}(id, title, description, path, mounts, chat_ids, council_config, status, metadata, created_at, updated_at) 
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
            )
            .run(
                id,
                title,
                description,
                workspacePath,
                mounts,
                chatIds,
                councilConfig,
                status,
                metadata,
                now,
                now
            );
        if ((insertResult.rowsAffected ?? 0) < 1) {
            throw new Error('Workspace insert did not persist.');
        }

        return this.mapRowToWorkspace({
            id,
            title,
            description,
            path: workspacePath,
            mounts,
            chat_ids: chatIds,
            council_config: councilConfig,
            status,
            metadata,
            created_at: now,
            updated_at: now,
        });
    }

    async updateWorkspace(id: string, updates: Partial<Workspace>): Promise<Workspace | undefined> {
        const fields: string[] = [];
        const values: unknown[] = [];
        const currentWorkspace = await this.getWorkspace(id);

        this.collectWorkspaceUpdates(updates, fields, values, currentWorkspace ?? undefined);

        if (fields.length === 0) {
            return this.getWorkspace(id);
        }

        fields.push('updated_at = ?');
        values.push(Date.now());
        values.push(id);

        await this.adapter
            .prepare(`UPDATE ${WORKSPACE_COMPAT_SCHEMA_VALUES.TABLE} SET ${fields.join(', ')} WHERE id = ? `)
            .run(...(values as SqlValue[]));
        return this.getWorkspace(id);
    }

    private collectWorkspaceUpdates(
        updates: Partial<Workspace>,
        fields: string[],
        values: unknown[],
        currentWorkspace?: Workspace
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
            const mergedMetadata = this.mergeWorkspaceMetadata(currentWorkspace?.metadata, updates);
            fields.push('metadata = ?');
            values.push(JSON.stringify(mergedMetadata));
        }
    }

    async deleteWorkspace(id: string, deleteFiles: boolean = false): Promise<void> {
        if (deleteFiles) {
            const ws = await this.getWorkspace(id);
            if (ws?.path && fs.existsSync(ws.path)) {
                try {
                    await fs.promises.rm(ws.path, { recursive: true, force: true });
                } catch (error) {
                    appLogger.error(
                        'WorkspaceRepository',
                        `Failed to delete workspace files at ${ws.path}`,
                        error as Error
                    );
                }
            }
        }
        await this.adapter.prepare(`DELETE FROM ${WORKSPACE_COMPAT_SCHEMA_VALUES.TABLE} WHERE id = ?`).run(id);
    }

    mapDbWorkspace(workspace: DbWorkspace): Workspace {
        return this.mapRowToWorkspace({
            id: workspace.id,
            title: workspace.title,
            description: workspace.description ?? '',
            path: workspace.path,
            mounts: workspace.mounts,
            chat_ids: workspace.chat_ids,
            council_config: workspace.council_config,
            status: workspace.status,
            metadata: workspace.metadata,
            created_at: workspace.created_at,
            updated_at: workspace.updated_at,
        });
    }

    private mapRowToWorkspace(row: JsonObject): Workspace {
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

    private normalizeMounts(value: unknown): Workspace['mounts'] {
        if (Array.isArray(value)) {
            return value as Workspace['mounts'];
        }
        if (typeof value === 'string') {
            const parsed = this.parseJsonField<unknown>(value, []);
            return Array.isArray(parsed) ? (parsed as Workspace['mounts']) : [];
        }
        return [];
    }

    private mergeWorkspaceMetadata(
        currentMetadata: JsonObject | undefined,
        updates: Partial<Workspace>
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

        const hasWorkspaceSettings = Boolean(nextBuildConfig ?? nextDevServer ?? nextAdvancedOptions);
        if (hasWorkspaceSettings) {
            const workspaceSettings: JsonObject = {};
            if (nextBuildConfig) {
                workspaceSettings.buildConfig = nextBuildConfig as unknown as JsonObject;
            }
            if (nextDevServer) {
                workspaceSettings.devServer = nextDevServer as unknown as JsonObject;
            }
            if (nextAdvancedOptions) {
                workspaceSettings.advancedOptions = nextAdvancedOptions as unknown as JsonObject;
            }
            baseMetadata.workspaceSettings = workspaceSettings;
        } else {
            delete (baseMetadata as Record<string, unknown>).workspaceSettings;
        }

        // Remove legacy top-level keys to keep metadata shape stable.
        delete (baseMetadata as Record<string, unknown>).buildConfig;
        delete (baseMetadata as Record<string, unknown>).devServer;
        delete (baseMetadata as Record<string, unknown>).advancedOptions;

        return baseMetadata;
    }

    private extractSettingsFromMetadata(metadata?: JsonObject): {
        buildConfig?: Workspace['buildConfig'];
        devServer?: Workspace['devServer'];
        advancedOptions?: Workspace['advancedOptions'];
    } {
        if (!this.isObject(metadata)) {
            return {};
        }

        const settingsContainer = this.isObject(
            (metadata as Record<string, unknown>).workspaceSettings
        )
            ? ((metadata as Record<string, unknown>).workspaceSettings as Record<string, unknown>)
            : (metadata as Record<string, unknown>);

        return {
            buildConfig: this.normalizeBuildConfig(settingsContainer.buildConfig),
            devServer: this.normalizeDevServer(settingsContainer.devServer),
            advancedOptions: this.normalizeAdvancedOptions(settingsContainer.advancedOptions),
        };
    }

    private normalizeBuildConfig(value: unknown): Workspace['buildConfig'] | undefined {
        if (!this.isObject(value)) {
            return undefined;
        }
        const v = value as Record<string, unknown>;
        const result: Workspace['buildConfig'] = {
            ...(typeof v.buildCommand === 'string' ? { buildCommand: v.buildCommand } : {}),
            ...(typeof v.testCommand === 'string' ? { testCommand: v.testCommand } : {}),
            ...(typeof v.lintCommand === 'string' ? { lintCommand: v.lintCommand } : {}),
            ...(typeof v.outputDir === 'string' ? { outputDir: v.outputDir } : {}),
            ...(typeof v.envFile === 'string' ? { envFile: v.envFile } : {}),
        };
        return Object.keys(result).length > 0 ? result : undefined;
    }

    private normalizeDevServer(value: unknown): Workspace['devServer'] | undefined {
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
        const result: Workspace['devServer'] = {
            ...(typeof v.command === 'string' ? { command: v.command } : {}),
            ...(Number.isFinite(normalizedPort) ? { port: normalizedPort as number } : {}),
            ...(typeof v.autoStart === 'boolean' ? { autoStart: v.autoStart } : {}),
        };
        return Object.keys(result).length > 0 ? result : undefined;
    }

    private normalizeAdvancedOptions(value: unknown): Workspace['advancedOptions'] | undefined {
        if (!this.isObject(value)) {
            return undefined;
        }
        const v = value as Record<string, unknown>;
        const result: Workspace['advancedOptions'] = {
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

    private normalizeCouncilConfig(value: unknown): Workspace['councilConfig'] {
        const defaultConfig: Workspace['councilConfig'] = {
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
