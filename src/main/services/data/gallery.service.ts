/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fs from 'fs';
import * as path from 'path';

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { DatabaseService } from '@main/services/data/database.service';
import { serializeToIpc } from '@main/utils/ipc-serializer.util';
import { assertPathWithinRoot } from '@main/utils/path-security.util';
import { GALLERY_CHANNELS } from '@shared/constants/ipc-channels';
import { RuntimeValue } from '@shared/types/common';
import { shell } from 'electron';

import { ImagePersistenceService } from './image-persistence.service';

type UnsafeValue = ReturnType<typeof JSON.parse>;

interface GalleryItem {
    name: string;
    path: string;
    url: string;
    mtime: number;
    type: 'image' | 'video';
    metadata?: UnsafeValue;
}

interface GalleryBatchDownloadResult {
    success: boolean;
    copied: number;
    skipped: number;
    errors: string[];
}

export class GalleryService {
    static readonly serviceName = 'galleryService';
    static readonly dependencies = ['databaseService', 'imagePersistence'] as const;
    private galleryRoot: string;

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly imagePersistence: ImagePersistenceService
    ) {
        this.galleryRoot = path.resolve(this.imagePersistence.getGalleryPath(), '..');
        this.ensureGalleryExists();
    }

    private ensureGalleryExists() {
        if (!fs.existsSync(this.galleryRoot)) {
            try {
                fs.mkdirSync(this.galleryRoot, { recursive: true });
                fs.mkdirSync(path.join(this.galleryRoot, 'images'), { recursive: true });
                fs.mkdirSync(path.join(this.galleryRoot, 'videos'), { recursive: true });
            } catch (e) {
                appLogger.error('GalleryService', `Failed to create gallery structure: ${e}`);
            }
        }
    }

    private resolveGalleryPath(inputPath: string) {
        return assertPathWithinRoot(inputPath, this.galleryRoot, 'gallery');
    }

    @ipc(GALLERY_CHANNELS.LIST)
    async listItems(): Promise<RuntimeValue> {
        try {
            const results: GalleryItem[] = [];
            const subdirs = ['images', 'videos'];

            // Ensure gallery_items table exists
            await this.databaseService.exec(`
                CREATE TABLE IF NOT EXISTS gallery_items (
                    path TEXT PRIMARY KEY,
                    prompt TEXT,
                    negative_prompt TEXT,
                    seed INTEGER,
                    steps INTEGER,
                    cfg_scale REAL,
                    width INTEGER,
                    height INTEGER,
                    model TEXT,
                    created_at BIGINT
                )
            `);

            const metadataMap: Record<string, UnsafeValue> = {};
            try {
                const dbResults = await this.databaseService.query<UnsafeValue>('SELECT * FROM gallery_items');
                dbResults.rows.forEach((row) => {
                    const key = path.basename(row.path);
                    metadataMap[key] = row;
                });
            } catch (e) {
                appLogger.error('GalleryService', `Failed to fetch gallery metadata: ${e}`);
            }

            for (const sub of subdirs) {
                const subPath = path.join(this.galleryRoot, sub);
                if (!fs.existsSync(subPath)) {continue;}

                const files = await fs.promises.readdir(subPath);
                const mediaFiles = files.filter(file => /\.(png|jpg|jpeg|webp|gif|mp4|webm|mov)$/i.test(file));
                
                const scannedItems = await Promise.all(mediaFiles.map(async (fileName): Promise<GalleryItem | null> => {
                    try {
                        const fullPath = path.join(subPath, fileName);
                        const resolvedPath = this.resolveGalleryPath(fullPath);
                        const stats = await fs.promises.stat(fullPath);
                        return {
                            name: fileName,
                            path: resolvedPath,
                            url: `safe-file://${resolvedPath.replace(/\\/g, '/')}`,
                            mtime: stats.mtime.getTime(),
                            type: sub === 'images' ? 'image' : 'video',
                            metadata: metadataMap[fileName]
                        };
                    } catch {
                        return null;
                    }
                }));
                results.push(...scannedItems.filter((item): item is GalleryItem => item !== null));
            }

            return serializeToIpc(results.sort((a, b) => b.mtime - a.mtime));
        } catch (error) {
            appLogger.error('GalleryService', `Gallery List Error: ${error}`);
            return serializeToIpc([]);
        }
    }

    @ipc(GALLERY_CHANNELS.DELETE)
    async deleteItem(filePath: string): Promise<RuntimeValue> {
        try {
            const safePath = this.resolveGalleryPath(filePath);
            await fs.promises.unlink(safePath);
            return serializeToIpc(true);
        } catch (error) {
            appLogger.error('GalleryService', `Gallery Delete Error: ${error}`);
            return serializeToIpc(false);
        }
    }

    @ipc(GALLERY_CHANNELS.OPEN)
    async openItem(filePath: string): Promise<RuntimeValue> {
        try {
            const safePath = this.resolveGalleryPath(filePath);
            await shell.openPath(safePath);
            return serializeToIpc(true);
        } catch {
            return serializeToIpc(false);
        }
    }

    @ipc(GALLERY_CHANNELS.REVEAL)
    async revealItem(filePath: string): Promise<RuntimeValue> {
        try {
            const safePath = this.resolveGalleryPath(filePath);
            shell.showItemInFolder(safePath);
            return serializeToIpc(true);
        } catch {
            return serializeToIpc(false);
        }
    }

    @ipc(GALLERY_CHANNELS.BATCH_DOWNLOAD)
    async batchDownload(payload: { filePaths: string[]; targetDirectory: string }): Promise<RuntimeValue> {
        const { filePaths, targetDirectory } = payload;
        const resolvedTargetDirectory = path.resolve(targetDirectory);
        await fs.promises.mkdir(resolvedTargetDirectory, { recursive: true });

        const result: GalleryBatchDownloadResult = {
            success: true,
            copied: 0,
            skipped: 0,
            errors: []
        };

        for (const filePath of filePaths) {
            try {
                const safePath = this.resolveGalleryPath(filePath);
                const fileName = path.basename(safePath);
                const uniqueTargetPath = await this.resolveUniqueTargetPath(resolvedTargetDirectory, fileName);
                await fs.promises.copyFile(safePath, uniqueTargetPath);
                result.copied++;
            } catch (error) {
                result.skipped++;
                result.success = false;
                result.errors.push(String(error));
            }
        }

        return serializeToIpc(result);
    }

    private async resolveUniqueTargetPath(targetDirectory: string, originalFileName: string): Promise<string> {
        const parsedPath = path.parse(originalFileName);
        for (let i = 0; i <= 10000; i++) {
            const candidateName = i === 0 ? originalFileName : `${parsedPath.name}-${i}${parsedPath.ext}`;
            const candidatePath = path.join(targetDirectory, candidateName);
            try {
                await fs.promises.access(candidatePath);
            } catch {
                return candidatePath;
            }
        }
        throw new Error('Unable to determine unique target file path');
    }
}

