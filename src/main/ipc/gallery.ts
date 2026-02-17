import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { DatabaseService } from '@main/services/data/database.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { assertPathWithinRoot } from '@main/utils/path-security.util';
import { ipcMain, IpcMainInvokeEvent, shell } from 'electron';

/** Maximum file path length */
const MAX_PATH_LENGTH = 4096;

/**
 * Validates a file path string
 */
function validateFilePath(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_PATH_LENGTH) {
        return null;
    }
    return trimmed;
}

interface GalleryItem {
    name: string
    path: string
    url: string
    mtime: number
    type: 'image' | 'video'
    metadata?: {
        prompt?: string
        negative_prompt?: string
        seed?: number
        steps?: number
        cfg_scale?: number
        width?: number
        height?: number
        model?: string
        created_at?: number
    }
}

/**
 * Registers IPC handlers for gallery media management
 * @param galleryPath - Root directory for gallery media files
 * @param databaseService - Optional database service for fetching gallery metadata
 */
export function registerGalleryIpc(galleryPath: string, databaseService?: DatabaseService) {
    const galleryRoot = path.resolve(galleryPath);
    const resolveGalleryPath = (inputPath: string) => assertPathWithinRoot(inputPath, galleryRoot, 'gallery');

    // Ensure gallery exists
    if (!fs.existsSync(galleryRoot)) {
        try {
            fs.mkdirSync(galleryRoot, { recursive: true });
        } catch (e) {
            appLogger.error('Gallery', `Failed to create gallery path: ${e}`);
        }
    }

    ipcMain.handle('gallery:list', createSafeIpcHandler('gallery:list', async () => {
        try {
            const results: GalleryItem[] = [];
            const subdirs = ['images', 'videos'];
            // Fetch metadata from DB if available
            interface GalleryItemMetadata {
                path: string;
                prompt?: string;
                negative_prompt?: string;
                seed?: number;
                steps?: number;
                cfg_scale?: number;
                width?: number;
                height?: number;
                model?: string;
                created_at?: number;
            }
            
            const metadataMap: Record<string, GalleryItemMetadata> = {};
            if (databaseService) {
                try {
                    const dbResults = await databaseService.query<GalleryItemMetadata>('SELECT * FROM gallery_items');
                    dbResults.rows.forEach((row) => {
                        metadataMap[row.path] = row;
                    });
                } catch (e) {
                    appLogger.error('Gallery', `Failed to fetch gallery metadata: ${e}`);
                }
            }

            for (const sub of subdirs) {
                const subPath = path.join(galleryRoot, sub);
                try {
                    await fs.promises.access(subPath);
                } catch {
                    continue;
                }

                const files = await fs.promises.readdir(subPath);
                const mediaFiles = files.filter(file => /\.(png|jpg|jpeg|webp|gif|mp4|webm|mov)$/i.test(file));
                const scannedItems = await Promise.all(mediaFiles.map(async (fileName): Promise<GalleryItem | null> => {
                    try {
                        const fullPath = path.join(subPath, fileName);
                        const resolvedPath = resolveGalleryPath(fullPath);
                        const stats = await fs.promises.stat(fullPath);
                        return {
                            name: fileName,
                            path: resolvedPath,
                            url: `safe-file://${resolvedPath.replace(/\\/g, '/')}`,
                            mtime: stats.mtime.getTime(),
                            type: sub === 'images' ? 'image' : 'video',
                            metadata: metadataMap[fileName]
                        };
                    } catch (error) {
                        appLogger.warn('Gallery', `Failed to stat gallery item ${fileName}: ${String(error)}`);
                        return null;
                    }
                }));
                results.push(...scannedItems.filter((item): item is GalleryItem => item !== null));
            }

            return results.sort((a, b) => b.mtime - a.mtime); // Newest first
        } catch (error) {
            appLogger.error('Gallery', `Gallery List Error: ${error}`);
            return [];
        }
    }, []));

    ipcMain.handle('gallery:delete', createSafeIpcHandler('gallery:delete', async (_event: IpcMainInvokeEvent, filePathRaw: unknown) => {
        const filePath = validateFilePath(filePathRaw);
        if (!filePath) {
            throw new Error('Invalid file path');
        }
        try {
            const safePath = resolveGalleryPath(filePath);
            await fs.promises.unlink(safePath);
            appLogger.info('Gallery', `Deleted file: ${safePath}`);
            return true;
        } catch (error) {
            appLogger.error('Gallery', `Gallery Delete Error: ${error}`);
            return false;
        }
    }, false));

    ipcMain.handle('gallery:open', createSafeIpcHandler('gallery:open', async (_event: IpcMainInvokeEvent, filePathRaw: unknown) => {
        const filePath = validateFilePath(filePathRaw);
        if (!filePath) {
            throw new Error('Invalid file path');
        }
        try {
            const safePath = resolveGalleryPath(filePath);
            await shell.openPath(safePath);
            return true;
        } catch (error) {
            appLogger.error('Gallery', `Gallery Open Error: ${error}`);
            return false;
        }
    }, false));

    ipcMain.handle('gallery:reveal', createSafeIpcHandler('gallery:reveal', async (_event: IpcMainInvokeEvent, filePathRaw: unknown) => {
        const filePath = validateFilePath(filePathRaw);
        if (!filePath) {
            throw new Error('Invalid file path');
        }
        try {
            const safePath = resolveGalleryPath(filePath);
            shell.showItemInFolder(safePath);
            return true;
        } catch (error) {
            appLogger.error('Gallery', `Gallery Reveal Error: ${error}`);
            return false;
        }
    }, false));
}
