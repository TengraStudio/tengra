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

import { ipc } from '@main/core/ipc-decorators';
import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { serializeToIpc } from '@main/utils/ipc-serializer.util';
import { CODE_LANGUAGE_CHANNELS } from '@shared/constants/ipc-channels';
import { marketplaceCodeLanguagePackSchema } from '@shared/schemas/marketplace.schema';
import { RuntimeValue } from '@shared/types/common';
import type { MarketplaceCodeLanguagePack } from '@shared/types/marketplace';

const CODE_LANGUAGE_FILE_SUFFIX = '.code-language-pack.json';

export class CodeLanguageService extends BaseService {
    static readonly serviceName = 'codeLanguageService';
    static readonly dependencies = ['dataService'] as const;
    private readonly packsDir: string;
    private readonly installedPacks = new Map<string, MarketplaceCodeLanguagePack>();

    constructor(private readonly dataService: DataService) {
        super('CodeLanguageService');
        const userDataPath = path.dirname(this.dataService.getPath('db'));
        this.packsDir = path.join(userDataPath, 'runtime', 'code-language-packs');
    }

    override async initialize(): Promise<void> {
        await fs.mkdir(this.packsDir, { recursive: true });
        await this.loadPacks();
    }

    override async cleanup(): Promise<void> {
        this.installedPacks.clear();
    }

    async reload(): Promise<void> {
        await this.loadPacks();
    }

    @ipc(CODE_LANGUAGE_CHANNELS.RUNTIME_GET_ALL)
    async getAllCodeLanguagePacksIpc(): Promise<RuntimeValue> {
        return serializeToIpc(await this.getAllCodeLanguagePacks());
    }

    async getAllCodeLanguagePacks(): Promise<MarketplaceCodeLanguagePack[]> {
        return Array.from(this.installedPacks.values());
    }

    getInstalledCodeLanguageIds(): Set<string> {
        return new Set(this.installedPacks.keys());
    }

    getCodeLanguagePacksDirectory(): string {
        return this.packsDir;
    }

    private async loadPacks(): Promise<void> {
        this.installedPacks.clear();
        const files = await fs.readdir(this.packsDir);
        for (const fileName of files) {
            if (!fileName.endsWith(CODE_LANGUAGE_FILE_SUFFIX)) {
                continue;
            }

            const filePath = path.join(this.packsDir, fileName);
            try {
                const content = await fs.readFile(filePath, 'utf8');
                const parsed = JSON.parse(content) as RuntimeValue;
                const validation = marketplaceCodeLanguagePackSchema.safeParse(parsed);
                if (!validation?.success) {
                    this.logWarn(`Skipping invalid code language pack: ${fileName}`);
                    continue;
                }
                this.installedPacks.set(validation.data.id, validation.data);
            } catch (error) {
                this.logError(`Failed to load code language pack ${fileName}`, error as Error);
            }
        }
    }
}

