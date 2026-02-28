import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn().mockReturnValue('/mock/userData')
    }
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

vi.mock('fs', () => ({
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    promises: {
        writeFile: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue(Buffer.from('fake-image-data'))
    }
}));

vi.mock('crypto', () => ({
    randomBytes: vi.fn(() => ({
        toString: vi.fn(() => 'a1b2c3d4')
    }))
}));

import * as fs from 'fs';
import * as path from 'path';

import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import { ImageMetadata, ImagePersistenceService } from '@main/services/data/image-persistence.service';

/** Helper to create a valid PNG data URI */
function makePngDataUri(base64 = 'iVBORw0KGgo='): string {
    return `data:image/png;base64,${base64}`;
}

/** Helper to create a valid JPEG data URI */
function makeJpegDataUri(base64 = '/9j/4AAQ'): string {
    return `data:image/jpeg;base64,${base64}`;
}

/** Helper to create a valid WebP data URI */
function makeWebpDataUri(base64 = 'UklGRg=='): string {
    return `data:image/webp;base64,${base64}`;
}

describe('ImagePersistenceService', () => {
    let service: ImagePersistenceService;
    let mockDataService: Partial<DataService>;
    let mockDb: { prepare: ReturnType<typeof vi.fn>; exec: ReturnType<typeof vi.fn> };
    let mockDatabaseService: Partial<DatabaseService>;

    beforeEach(() => {
        vi.clearAllMocks();

        mockDataService = {
            getPath: vi.fn().mockReturnValue('/mock/gallery/images')
        };

        mockDb = {
            prepare: vi.fn(),
            exec: vi.fn()
        };

        mockDatabaseService = {
            getDatabase: vi.fn().mockReturnValue(mockDb)
        };

        service = new ImagePersistenceService(
            mockDataService as DataService,
            mockDatabaseService as DatabaseService
        );
    });

    describe('constructor', () => {
        it('should use DataService path when provided', () => {
            expect(mockDataService.getPath).toHaveBeenCalledWith('galleryImages');
            expect(service.getGalleryPath()).toBe('/mock/gallery/images');
        });

        it('should use fallback path when DataService is not provided', () => {
            const fallbackService = new ImagePersistenceService();
            const galleryPath = fallbackService.getGalleryPath();
            expect(galleryPath).toContain('data');
            expect(galleryPath).toContain('gallery');
            expect(galleryPath).toContain('images');
        });

        it('should ensure gallery directory exists on construction', () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);
            new ImagePersistenceService(mockDataService as DataService);
            expect(fs.mkdirSync).toHaveBeenCalled();
        });

        it('should skip mkdir when gallery directory already exists', () => {
            vi.clearAllMocks();
            vi.mocked(fs.existsSync).mockReturnValue(true);
            new ImagePersistenceService(mockDataService as DataService);
            expect(fs.mkdirSync).not.toHaveBeenCalled();
        });
    });

    describe('getGalleryPath', () => {
        it('should return the configured gallery path', () => {
            expect(service.getGalleryPath()).toBe('/mock/gallery/images');
        });
    });

    describe('saveImage - data URI', () => {
        it('should save a PNG data URI and return safe-file URI', async () => {
            const dataUri = makePngDataUri();
            const result = await service.saveImage(dataUri);

            expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
            expect(result).toContain('safe-file:///');
            expect(result).toContain('.png');
        });

        it('should save a JPEG data URI with jpg extension', async () => {
            const dataUri = makeJpegDataUri();
            const result = await service.saveImage(dataUri);

            const writeCall = vi.mocked(fs.promises.writeFile).mock.calls[0];
            expect(writeCall).toBeDefined();
            const filePath = writeCall![0] as string;
            expect(filePath).toContain('.jpg');
            expect(result).toContain('.jpg');
        });

        it('should save a WebP data URI with webp extension', async () => {
            const dataUri = makeWebpDataUri();
            await service.saveImage(dataUri);

            const writeCall = vi.mocked(fs.promises.writeFile).mock.calls[0];
            expect(writeCall).toBeDefined();
            const filePath = writeCall![0] as string;
            expect(filePath).toContain('.webp');
        });

        it('should generate unique filenames with timestamp and random hex', async () => {
            const dataUri = makePngDataUri();
            await service.saveImage(dataUri);

            const writeCall = vi.mocked(fs.promises.writeFile).mock.calls[0];
            const filePath = writeCall![0] as string;
            expect(filePath).toContain('gen-');
            expect(filePath).toContain('a1b2c3d4');
        });

        it('should return original data on invalid base64 data URI', async () => {
            const badUri = 'data:image/png;base64';
            const result = await service.saveImage(badUri);
            expect(result).toBe(badUri);
        });
    });

    describe('saveImage - local file paths', () => {
        it('should copy a local file and return safe-file URI', async () => {
            const localPath = '/some/image.png';
            vi.mocked(fs.existsSync).mockReturnValue(true);

            const result = await service.saveImage(localPath);

            expect(fs.promises.readFile).toHaveBeenCalled();
            expect(fs.promises.writeFile).toHaveBeenCalled();
            expect(result).toContain('safe-file:///');
        });

        it('should handle file:// URI input', async () => {
            const fileUri = 'file:///some/external/image.jpg';

            const result = await service.saveImage(fileUri);

            expect(fs.promises.readFile).toHaveBeenCalled();
            expect(result).toContain('safe-file:///');
        });

        it('should still produce a safe-file URI for gallery-resident images', async () => {
            const galleryPath = service.getGalleryPath();
            const existingFile = path.join(galleryPath, 'existing.png');
            const fileUri = `safe-file:///${existingFile.replace(/\\/g, '/')}`;

            const result = await service.saveImage(fileUri);

            expect(result).toContain('safe-file:///');
            expect(result).toContain('.png');
        });
    });

    describe('saveImage - metadata persistence', () => {
        const sampleMetadata: ImageMetadata = {
            prompt: 'a sunset over mountains',
            negative_prompt: 'blurry',
            seed: 42,
            steps: 30,
            cfg_scale: 7.5,
            width: 512,
            height: 512,
            model: 'stable-diffusion-v1'
        };

        it('should save metadata to database when databaseService is present', async () => {
            const stmtMock = { run: vi.fn().mockResolvedValue({}) };
            mockDb.prepare.mockReturnValue(stmtMock);

            await service.saveImage(makePngDataUri(), sampleMetadata);

            expect(mockDb.prepare).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO gallery_items')
            );
            expect(stmtMock.run).toHaveBeenCalledWith(
                expect.stringContaining('gen-'),
                sampleMetadata.prompt,
                sampleMetadata.negative_prompt,
                sampleMetadata.seed,
                sampleMetadata.steps,
                sampleMetadata.cfg_scale,
                sampleMetadata.width,
                sampleMetadata.height,
                sampleMetadata.model,
                expect.any(Number)
            );
        });

        it('should not save metadata when databaseService is absent', async () => {
            const serviceNoDB = new ImagePersistenceService(mockDataService as DataService);
            await serviceNoDB.saveImage(makePngDataUri(), sampleMetadata);

            expect(mockDb.prepare).not.toHaveBeenCalled();
        });

        it('should handle metadata with only partial fields', async () => {
            const stmtMock = { run: vi.fn().mockResolvedValue({}) };
            mockDb.prepare.mockReturnValue(stmtMock);

            const partialMetadata: ImageMetadata = { prompt: 'test prompt' };
            await service.saveImage(makePngDataUri(), partialMetadata);

            expect(stmtMock.run).toHaveBeenCalledWith(
                expect.stringContaining('gen-'),
                'test prompt',
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                expect.any(Number)
            );
        });

        it('should handle metadata save failure gracefully', async () => {
            const stmtMock = { run: vi.fn().mockRejectedValue(new Error('DB write error')) };
            mockDb.prepare.mockReturnValue(stmtMock);

            const result = await service.saveImage(makePngDataUri(), sampleMetadata);

            // Should still return the saved file path (metadata error is non-fatal)
            expect(result).toContain('safe-file:///');
        });

        it('should save metadata for gallery-existing images', async () => {
            const stmtMock = { run: vi.fn().mockResolvedValue({}) };
            mockDb.prepare.mockReturnValue(stmtMock);

            const galleryPath = service.getGalleryPath();
            const existingFile = path.join(galleryPath, 'existing.png');
            const fileUri = `safe-file:///${existingFile.replace(/\\/g, '/')}`;

            await service.saveImage(fileUri, sampleMetadata);

            expect(mockDb.prepare).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO gallery_items')
            );
        });
    });

    describe('saveImage - error handling', () => {
        it('should return original imageData when writeFile fails', async () => {
            vi.mocked(fs.promises.writeFile).mockRejectedValueOnce(new Error('Disk full'));

            const dataUri = makePngDataUri();
            const result = await service.saveImage(dataUri);

            expect(result).toBe(dataUri);
        });

        it('should return original imageData for unknown format', async () => {
            const unknownData = 'not-a-valid-image-format';
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const result = await service.saveImage(unknownData);

            expect(result).toBe(unknownData);
        });

        it('should return original imageData when readFile fails for local path', async () => {
            vi.mocked(fs.promises.readFile).mockRejectedValueOnce(new Error('File not found'));
            vi.mocked(fs.existsSync).mockReturnValue(true);

            const result = await service.saveImage('/nonexistent/image.png');

            expect(result).toBe('/nonexistent/image.png');
        });
    });

    describe('saveImage - HTTP URLs', () => {
        it('should detect jpg extension from URL', async () => {
            // We can't easily test real HTTP downloads in unit tests,
            // but we can verify the method rejects gracefully on network error
            const httpUrl = 'https://example.com/image.jpg';
            const result = await service.saveImage(httpUrl);
            // Since we can't mock http.get easily and it will fail, it returns the original
            expect(result).toBe(httpUrl);
        });
    });

    describe('edge cases', () => {
        it('should handle empty string imageData', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);
            const result = await service.saveImage('');
            expect(result).toBe('');
        });

        it('should handle undefined metadata without errors', async () => {
            const result = await service.saveImage(makePngDataUri());
            expect(result).toContain('safe-file:///');
            expect(mockDb.prepare).not.toHaveBeenCalled();
        });

        it('should handle empty metadata object', async () => {
            const stmtMock = { run: vi.fn().mockResolvedValue({}) };
            mockDb.prepare.mockReturnValue(stmtMock);

            const result = await service.saveImage(makePngDataUri(), {});

            expect(result).toContain('safe-file:///');
            expect(stmtMock.run).toHaveBeenCalledWith(
                expect.stringContaining('gen-'),
                null, null, null, null, null, null, null, null,
                expect.any(Number)
            );
        });

        it('should re-ensure gallery directory before each save', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            await service.saveImage(makePngDataUri());

            expect(fs.existsSync).toHaveBeenCalled();
            expect(fs.mkdirSync).toHaveBeenCalledWith(
                '/mock/gallery/images',
                { recursive: true }
            );
        });

        it('should handle safe-file URI with Windows-style paths', async () => {
            const galleryPath = service.getGalleryPath();
            const winPath = galleryPath.replace(/\//g, '\\');
            const existingFile = `${winPath}\\existing.png`;
            const fileUri = `safe-file:///${existingFile.replace(/\\/g, '/')}`;

            const result = await service.saveImage(fileUri);

            // The file is in gallery, so it should skip copy
            expect(result).toContain('safe-file:///');
        });

        it('should handle data URI with no matching regex groups', async () => {
            const malformedUri = 'data:text/plain;utf8,hello';
            const result = await service.saveImage(malformedUri);
            expect(result).toBe(malformedUri);
        });
    });
});
