/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { ipc } from '@main/core/ipc-decorators';
import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { LOCALE_CHANNELS } from '@shared/constants/ipc-channels';
import { localePackSchema } from '@shared/schemas/locale.schema';
import { LocalePack, LocalePackManifest } from '@shared/types/locale';
import { getErrorMessage } from '@shared/utils/error.util';
import { app } from 'electron';

const LOCALE_FILE_SUFFIX = '.locale.json';

export class LocaleService extends BaseService {
    private readonly localesDir: string;
    private readonly installedLocales = new Map<string, LocalePack>();

    constructor(private readonly dataService: DataService) {
        super('LocaleService');
        const userDataPath = path.dirname(this.dataService.getPath('db'));
        this.localesDir = path.join(userDataPath, 'runtime', 'locales');
    }

    override async initialize(): Promise<void> {
        await fs.mkdir(this.localesDir, { recursive: true });
        await this.syncLocalesFromSource();
        await this.loadLocales();
    }

    private async syncLocalesFromSource(): Promise<void> {
        const appPath = app.getAppPath();
        const possibleSourceDirs = [
            path.join(path.dirname(appPath), 'locales'),
            path.join(appPath, 'dist/renderer/i18n/locales'),
            path.join(appPath, 'renderer/i18n/locales'),
            path.join(__dirname, '../../src/renderer/i18n/locales'),
            path.join(__dirname, '../../../src/renderer/i18n/locales'),
        ];

        for (const sourceDir of possibleSourceDirs) {
            await this.syncLocaleDir(sourceDir);
        }
    }

    private async syncLocaleDir(sourceDir: string): Promise<void> {
        try {
            const files = await fs.readdir(sourceDir);
            for (const fileName of files) {
                if (!fileName.endsWith(LOCALE_FILE_SUFFIX)) {
                    continue;
                }
                await this.syncLocaleFile(sourceDir, fileName);
            }
        } catch {
            // Directory doesn't exist, skip
        }
    }

    private async syncLocaleFile(sourceDir: string, fileName: string): Promise<void> {
        const sourcePath = path.join(sourceDir, fileName);
        const targetPath = path.join(this.localesDir, fileName);

        try {
            const [sourceBytes, targetBytes] = await Promise.all([
                fs.readFile(sourcePath),
                fs.readFile(targetPath).catch(() => null),
            ]);

            if (!targetBytes || !sourceBytes.equals(targetBytes)) {
                await fs.copyFile(sourcePath, targetPath);
                this.logInfo(`Synced locale ${fileName} from ${sourcePath}`);
            }
        } catch (error) {
            this.logWarn(`Failed to sync locale ${fileName}: ${getErrorMessage(error as Error)}`);
        }
    }

    override async cleanup(): Promise<void> {
        this.installedLocales.clear();
    }

    async reload(): Promise<void> {
        await this.loadLocales();
    }

    async getAllLocales(): Promise<LocalePackManifest[]> {
        return Array.from(this.installedLocales.values()).map(locale => ({
            id: locale.id,
            locale: locale.locale,
            displayName: locale.displayName,
            nativeName: locale.nativeName,
            version: locale.version,
            description: locale.description,
            author: locale.author,
            baseLocale: locale.baseLocale,
            rtl: locale.rtl,
            coverage: locale.coverage,
            schemaVersion: locale.schemaVersion,
        }));
    }

    @ipc(LOCALE_CHANNELS.RUNTIME_GET_ALL)
    async getAllLocalePacksIpc() {
        return this.getAllLocalePacks();
    }

    async getAllLocalePacks(): Promise<LocalePack[]> {
        return Array.from(this.installedLocales.values());
    }

    getLocalePack(locale: string): LocalePack | undefined {
        return this.installedLocales.get(locale);
    }

    async getInstalledLocaleIds(): Promise<Set<string>> {
        return new Set(Array.from(this.installedLocales.keys()));
    }

    getLocalesDirectory(): string {
        return this.localesDir;
    }

    private async loadLocales(): Promise<void> {
        this.installedLocales.clear();
        const files = await fs.readdir(this.localesDir);

        for (const fileName of files) {
            if (!fileName.endsWith(LOCALE_FILE_SUFFIX)) {
                continue;
            }

            const filePath = path.join(this.localesDir, fileName);
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const parsed = JSON.parse(content) as RuntimeValue;
                const validation = localePackSchema.safeParse(parsed);
                if (!validation.success) {
                    this.logWarn(`Skipping invalid locale pack: ${fileName}`);
                    continue;
                }
                this.installedLocales.set(validation.data.locale, validation.data);
            } catch (error) {
                this.logError(`Failed to load locale pack ${fileName}`, error as Error);
            }
        }
    }
}

