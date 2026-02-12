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
            const localSourcePath = this.toLocalPathIfFileUri(imageData);

            // If the image is already a local gallery file, avoid duplicate copies.
            if (localSourcePath && this.isInGallery(localSourcePath)) {
                if (this.databaseService && metadata) {
                    await this.saveMetadataToDB(path.basename(localSourcePath), metadata);
                }
                return `safe-file:///${localSourcePath.replace(/\\/g, '/')}`;
            }

            const { buffer, extension } = await this.processImageData(imageData);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const random = crypto.randomBytes(4).toString('hex');
            const filename = `gen-${timestamp}-${random}.${extension}`;
            const filePath = path.join(this.galleryPath, filename);

            await fs.promises.writeFile(filePath, buffer);
            appLogger.info('ImagePersistence', `Saved generated image to ${filePath}`);

            if (this.databaseService && metadata) {
                await this.saveMetadataToDB(filename, metadata);
            }

            return `safe-file:///${filePath.replace(/\\/g, '/')}`;
        } catch (error) {
            const message = getErrorMessage(error as Error);
            appLogger.error('ImagePersistence', `Failed to save image: ${message}`);
            return imageData;
        }
    }

    private async processImageData(imageData: string): Promise<{ buffer: Buffer; extension: string }> {
        if (imageData.startsWith('data:')) {
            return this.processDataUri(imageData);
        }
        if (imageData.startsWith('http')) {
            return this.processHttpImage(imageData);
        }
        const localPath = this.toLocalPathIfFileUri(imageData);
        if (localPath) {
            return this.processLocalImage(localPath);
        }
        if (path.isAbsolute(imageData) || fs.existsSync(imageData)) {
            return this.processLocalImage(imageData);
        }
        throw new Error('Unknown image data format');
    }

    private processDataUri(dataUri: string): { buffer: Buffer; extension: string } {
        const matches = dataUri.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (matches?.length !== 3) {
            throw new Error('Invalid base64 string');
        }
        const type = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        let extension = 'png';
        if (type.includes('jpeg')) { extension = 'jpg'; }
        else if (type.includes('webp')) { extension = 'webp'; }
        return { buffer, extension };
    }

    private async processHttpImage(url: string): Promise<{ buffer: Buffer; extension: string }> {
        const buffer = await this.downloadImage(url);
        let extension = 'png';
        if (url.includes('.jpg') || url.includes('.jpeg')) { extension = 'jpg'; }
        else if (url.includes('.webp')) { extension = 'webp'; }
        return { buffer, extension };
    }

    private async processLocalImage(filePath: string): Promise<{ buffer: Buffer; extension: string }> {
        const normalizedPath = filePath.replace(/^safe-file:/i, '').replace(/^file:/i, '');
        const buffer = await fs.promises.readFile(normalizedPath);
        const ext = path.extname(normalizedPath).toLowerCase();
        const extension = ext === '.jpg' || ext === '.jpeg' ? 'jpg' : ext === '.webp' ? 'webp' : 'png';
        return { buffer, extension };
    }

    private toLocalPathIfFileUri(input: string): string | null {
        const normalized = input.trim();
        const isFileUri = normalized.startsWith('safe-file://') || normalized.startsWith('file://');
        if (!isFileUri) {
            return null;
        }

        let localPath = normalized
            .replace(/^safe-file:\/+/i, '')
            .replace(/^file:\/+/i, '');

        localPath = decodeURIComponent(localPath);

        // Windows file URI may become /C:/... after stripping.
        if (/^\/[A-Za-z]:\//.test(localPath)) {
            localPath = localPath.slice(1);
        }

        return process.platform === 'win32' ? localPath.replace(/\//g, '\\') : `/${localPath}`;
    }

    private isInGallery(filePath: string): boolean {
        const resolvedGallery = path.resolve(this.galleryPath);
        const resolvedFile = path.resolve(filePath);
        return resolvedFile.startsWith(resolvedGallery + path.sep) || resolvedFile === resolvedGallery;
    }

    private async saveMetadataToDB(filename: string, metadata: ImageMetadata): Promise<void> {
        if (!this.databaseService) { return; }
        try {
            const db = this.databaseService.getDatabase();
            const values = this.prepareMetadataValues(filename, metadata);
            await db.prepare(
                `INSERT INTO gallery_items (
                    path, prompt, negative_prompt, seed, steps, cfg_scale, width, height, model, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(...values);
        } catch (error) {
            appLogger.error('ImagePersistence', `Failed to save image metadata: ${getErrorMessage(error as Error)}`);
        }
    }

    private prepareMetadataValues(filename: string, metadata: ImageMetadata): (string | number | null)[] {
        return [
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
        ];
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
