import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import { getErrorMessage } from '@shared/utils/error.util';
import { app } from 'electron';

export interface ImageMetadata {
    prompt?: string;
    negative_prompt?: string;
    seed?: number;
    steps?: number;
    cfg_scale?: number;
    width?: number;
    height?: number;
    model?: string;
}


export class ImagePersistenceService {
    private galleryPath: string;

    constructor(
        private dataService?: DataService,
        private databaseService?: DatabaseService
    ) {
        if (this.dataService) {
            this.galleryPath = this.dataService.getPath('galleryImages');
        } else {
            // Fallback: match userData/data/gallery/images structure
            const userData = app.getPath('userData');
            this.galleryPath = path.join(userData, 'data', 'gallery', 'images');
        }
        this.ensureGalleryExists();
    }

    private ensureGalleryExists() {
        if (!fs.existsSync(this.galleryPath)) {
            fs.mkdirSync(this.galleryPath, { recursive: true });
        }
    }

    public getGalleryPath(): string {
        return this.galleryPath;
    }

    /**
     * Saves an image from a Data URI or URL to the local Gallery folder.
     * Returns the local file URI (file://...)
     */
    async saveImage(imageData: string, metadata?: ImageMetadata): Promise<string> {
        try {
            this.ensureGalleryExists();
            let buffer: Buffer;
            let extension = 'png'; // Default

            if (imageData.startsWith('data:')) {
                // Handle Data URI
                const matches = imageData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
                if (matches?.length !== 3) {
                    throw new Error('Invalid base64 string');
                }
                const type = matches[1];
                buffer = Buffer.from(matches[2], 'base64');

                if (type.includes('jpeg')) { extension = 'jpg'; }
                else if (type.includes('webp')) { extension = 'webp'; }

            } else if (imageData.startsWith('http')) {
                // Handle URL
                buffer = await this.downloadImage(imageData);
                // Try to infer extension from URL or header? For now default png/jpg
                if (imageData.includes('.jpg') || imageData.includes('.jpeg')) { extension = 'jpg'; }
                if (imageData.includes('.webp')) { extension = 'webp'; }
            } else {
                throw new Error('Unknown image data format');
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const random = crypto.randomBytes(4).toString('hex');
            const filename = `gen-${timestamp}-${random}.${extension}`;
            const filePath = path.join(this.galleryPath, filename);

            await fs.promises.writeFile(filePath, buffer);
            appLogger.info('ImagePersistence', `Saved generated image to ${filePath}`);

            // Save metadata to database if available
            if (this.databaseService && metadata) {
                try {
                    const db = this.databaseService.getDatabase();
                    await db.prepare(
                        `INSERT INTO gallery_items (
                            path, prompt, negative_prompt, seed, steps, cfg_scale, width, height, model, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).run(
                        filename,
                        metadata.prompt ?? null,
                        metadata.negative_prompt ?? null,
                        metadata.seed ?? null,
                        metadata.steps ?? null,
                        metadata.cfg_scale ?? null,
                        metadata.width ?? null,
                        metadata.height ?? null,
                        metadata.model ?? null,
                        Date.now()
                    );
                } catch (error) {
                    appLogger.error('ImagePersistence', `Failed to save image metadata: ${getErrorMessage(error as Error)}`);
                }
            }

            // Return safe-file URI for Electron/Browser usage
            return `safe-file:///${filePath.replace(/\\/g, '/')}`;

        } catch (error) {
            const message = getErrorMessage(error as Error);
            appLogger.error('ImagePersistence', `Failed to save image: ${message}`);
            return imageData; // Fallback to original if save fails
        }
    }

    private downloadImage(url: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : http;
            client.get(url, (res) => {
                const data: Buffer[] = [];
                res.on('data', (chunk) => data.push(chunk));
                res.on('end', () => resolve(Buffer.concat(data)));
            }).on('error', reject);
        });
    }
}
