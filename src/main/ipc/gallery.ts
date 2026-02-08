import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { DatabaseService } from '@main/services/data/database.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { assertPathWithinRoot } from '@main/utils/path-security.util';
import { ipcMain, shell } from 'electron';


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

    ipcMain.handle('gallery:list', createIpcHandler('gallery:list', async () => {
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
                if (!fs.existsSync(subPath)) { continue; }

                const files = await fs.promises.readdir(subPath);
                for (const f of files) {
                    if (/\.(png|jpg|jpeg|webp|gif|mp4|webm|mov)$/i.test(f)) {
                        const fullPath = path.join(subPath, f);
                        const resolvedPath = resolveGalleryPath(fullPath);
                        const stats = fs.statSync(fullPath);
                        results.push({
                            name: f,
                            path: resolvedPath,
                            url: `safe-file://${resolvedPath.replace(/\\/g, '/')}`,
                            mtime: stats.mtime.getTime(),
                            type: sub === 'images' ? 'image' : 'video',
                            metadata: metadataMap[f]
                        });
                    }
                }
            }

            return results.sort((a, b) => b.mtime - a.mtime); // Newest first
        } catch (error) {
            appLogger.error('Gallery', `Gallery List Error: ${error}`);
            return [];
        }
    }));

    ipcMain.handle('gallery:delete', createIpcHandler('gallery:delete', async (_event, filePath: string) => {
        try {
            const safePath = resolveGalleryPath(filePath);
            await fs.promises.unlink(safePath);
            return true;
        } catch (error) {
            appLogger.error('Gallery', `Gallery Delete Error: ${error}`);
            return false;
        }
    }));

    ipcMain.handle('gallery:open', createIpcHandler('gallery:open', async (_event, filePath: string) => {
        try {
            const safePath = resolveGalleryPath(filePath);
            await shell.openPath(safePath);
            return true;
        } catch (error) {
            appLogger.error('Gallery', `Gallery Open Error: ${error}`);
            return false;
        }
    }));

    ipcMain.handle('gallery:reveal', createIpcHandler('gallery:reveal', async (_event, filePath: string) => {
        try {
            const safePath = resolveGalleryPath(filePath);
            shell.showItemInFolder(safePath);
            return true;
        } catch (error) {
            appLogger.error('Gallery', `Gallery Reveal Error: ${error}`);
            return false;
        }
    }));
}
