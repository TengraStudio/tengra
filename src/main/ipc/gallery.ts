import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
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

import { DatabaseService } from '@main/services/data/database.service';

export function registerGalleryIpc(galleryPath: string, databaseService?: DatabaseService) {

    // Ensure gallery exists
    if (!fs.existsSync(galleryPath)) {
        try {
            fs.mkdirSync(galleryPath, { recursive: true });
        } catch (e) {
            appLogger.error('Gallery', `Failed to create gallery path: ${e}`);
        }
    }

    ipcMain.handle('gallery:list', async () => {
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
                const subPath = path.join(galleryPath, sub);
                if (!fs.existsSync(subPath)) { continue; }

                const files = await fs.promises.readdir(subPath);
                for (const f of files) {
                    if (/\.(png|jpg|jpeg|webp|gif|mp4|webm|mov)$/i.test(f)) {
                        const fullPath = path.join(subPath, f);
                        const stats = fs.statSync(fullPath);
                        results.push({
                            name: f,
                            path: fullPath,
                            url: `safe-file://${fullPath.replace(/\\/g, '/')}`,
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
    });

    ipcMain.handle('gallery:delete', async (_event, filePath) => {
        try {
            // Security check: ensure filePath is within galleryPath
            if (!filePath.startsWith(galleryPath) && !filePath.includes('Orbit/Gallery')) {
                throw new Error('Unauthorized file deletion');
            }
            await fs.promises.unlink(filePath);
            return true;
        } catch (error) {
            appLogger.error('Gallery', `Gallery Delete Error: ${error}`);
            return false;
        }
    });

    ipcMain.handle('gallery:open', async (_event, filePath) => {
        try {
            await shell.openPath(filePath);
            return true;
        } catch (error) {
            appLogger.error('Gallery', `Gallery Open Error: ${error}`);
            return false;
        }
    });

    ipcMain.handle('gallery:reveal', async (_event, filePath) => {
        try {
            shell.showItemInFolder(filePath);
            return true;
        } catch (error) {
            appLogger.error('Gallery', `Gallery Reveal Error: ${error}`);
            return false;
        }
    });
}
