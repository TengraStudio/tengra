import { watch } from 'fs';
import { createWriteStream } from 'fs';
import * as fs from 'fs/promises';
import * as https from 'https';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { JsonObject } from '@shared/types/common';
import { AISystemType } from '@shared/types/file-diff';
import { ServiceResponse } from '@shared/types/index';
import { getErrorMessage } from '@shared/utils/error.util';

import type { FileChangeTracker } from './file-change-tracker.service';

export class FileSystemService {
    private allowedRoots: string[] = [];
    private fileChangeTracker?: FileChangeTracker;

    constructor(allowedRoots?: string[], fileChangeTracker?: FileChangeTracker) {
        if (allowedRoots) {
            this.allowedRoots = allowedRoots.map(r => path.resolve(r));
        }
        this.fileChangeTracker = fileChangeTracker;
    }

    setFileChangeTracker(tracker: FileChangeTracker) {
        this.fileChangeTracker = tracker;
    }

    updateAllowedRoots(allowedRoots: string[]) {
        this.allowedRoots = allowedRoots.map(r => path.resolve(r));
    }

    private isPathAllowed(filePath: string): boolean {
        const absolutePath = path.resolve(filePath);
        return this.allowedRoots.some(root => {
            if (absolutePath === root) { return true; }
            return absolutePath.startsWith(root + path.sep);
        });
    }

    private validatePath(filePath: string) {
        if (!this.isPathAllowed(filePath)) {
            throw new Error(`Access denied: Path is outside allowed directories. (${filePath})`);
        }
    }



    private ignorePatterns: string[] = ['node_modules', '.git', 'dist', 'build', '.tandem', '.DS_Store'];

    updateIgnorePatterns(patterns: string[]) {
        this.ignorePatterns = [...new Set([...this.ignorePatterns, ...patterns])];
    }

    private shouldIgnore(filePath: string): boolean {
        // Simple string inclusion checker for now, should be replaced with proper minimatch/glob later
        return this.ignorePatterns.some(pattern => filePath.includes(path.sep + pattern) || filePath.endsWith(path.sep + pattern));
    }

    // --- Core Operations ---

    async readFile(filePath: string): Promise<ServiceResponse<string>> {
        try {
            this.validatePath(filePath);
            const absolutePath = path.resolve(filePath);
            const stats = await fs.stat(absolutePath);

            // 10MB limit
            if (stats.size > 10 * 1024 * 1024) {
                return { success: false, error: 'File too large (>10MB)' };
            }

            // Simple binary check: read first 1024 bytes and look for null bytes
            const handle = await fs.open(absolutePath, 'r');
            const buffer = Buffer.alloc(Math.min(stats.size, 1024));
            await handle.read(buffer, 0, buffer.length, 0);
            await handle.close();

            // If it contains a null byte, effectively considered binary
            if (buffer.includes(0)) {
                return { success: false, error: 'File is binary' };
            }

            const content = await fs.readFile(absolutePath, 'utf-8');
            return { success: true, data: content };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async readImage(filePath: string): Promise<ServiceResponse<string>> {
        try {
            this.validatePath(filePath);
            const absolutePath = path.resolve(filePath);
            const stats = await fs.stat(absolutePath);
            if (stats.size > 20 * 1024 * 1024) { // 20MB limit for images
                return { success: false, error: 'Image too large (>20MB)' };
            }
            const buffer = await fs.readFile(absolutePath);
            const base64 = buffer.toString('base64');

            // Determine mime type from extension
            const ext = path.extname(absolutePath).toLowerCase();
            let mime = 'image/jpeg';
            if (ext === '.png') { mime = 'image/png'; }
            if (ext === '.gif') { mime = 'image/gif'; }
            if (ext === '.webp') { mime = 'image/webp'; }
            if (ext === '.svg') { mime = 'image/svg+xml'; }

            return { success: true, data: `data:${mime};base64,${base64}` };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async isBinaryFile(filePath: string): Promise<boolean> {
        try {
            this.validatePath(filePath);
            const absolutePath = path.resolve(filePath);
            const stats = await fs.stat(absolutePath);
            if (stats.size === 0) { return false; }

            const handle = await fs.open(absolutePath, 'r');
            const buffer = Buffer.alloc(Math.min(stats.size, 1024));
            await handle.read(buffer, 0, buffer.length, 0);
            await handle.close();

            return buffer.includes(0);
        } catch {
            return false;
        }
    }

    async writeFile(filePath: string, content: string): Promise<ServiceResponse> {
        try {
            this.validatePath(filePath);
            const absolutePath = path.resolve(filePath);
            const dir = path.dirname(absolutePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(absolutePath, content, 'utf-8');
            return { success: true };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    /**
     * Write file with AI change tracking
     */
    async writeFileWithTracking(
        filePath: string,
        content: string,
        context: {
            aiSystem: AISystemType
            chatSessionId?: string
            changeReason?: string
            metadata?: JsonObject
        }
    ): Promise<ServiceResponse> {
        try {
            this.validatePath(filePath);
            const absolutePath = path.resolve(filePath);

            // Get current content if file exists
            let beforeContent = '';
            try {
                beforeContent = await fs.readFile(absolutePath, 'utf-8');
            } catch {
                // File doesn't exist, beforeContent stays empty
            }

            // Write the new content
            const dir = path.dirname(absolutePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(absolutePath, content, 'utf-8');

            // Track the change if tracker is available
            if (this.fileChangeTracker) {
                await this.fileChangeTracker.trackFileChange(absolutePath, beforeContent, content, context);
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async listDirectory(dirPath: string): Promise<ServiceResponse<Array<{ name: string; isDirectory: boolean; size?: number; modified?: string }>>> {
        try {
            this.validatePath(dirPath);
            const absolutePath = path.resolve(dirPath);
            const entries = await fs.readdir(absolutePath, { withFileTypes: true });

            const filteredEntries = entries.filter(entry => !this.shouldIgnore(path.join(absolutePath, entry.name)));

            const files = await Promise.all(
                filteredEntries.map(async (entry) => {
                    const entryPath = path.join(absolutePath, entry.name);
                    let size: number | undefined;
                    let modified: string | undefined;
                    try {
                        const stats = await fs.stat(entryPath);
                        size = stats.size;
                        modified = stats.mtime.toISOString();
                    } catch (e) {
                        appLogger.warn('filesystem.service', `Failed to stat ${entryPath}: ${getErrorMessage(e as Error)}`);
                    }
                    return {
                        name: entry.name,
                        isDirectory: entry.isDirectory(),
                        size,
                        modified
                    };
                })
            );
            return { success: true, data: files };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async createDirectory(dirPath: string): Promise<ServiceResponse> {
        try {
            this.validatePath(dirPath);
            const absolutePath = path.resolve(dirPath);
            await fs.mkdir(absolutePath, { recursive: true });
            return { success: true };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async deleteFile(filePath: string): Promise<ServiceResponse> {
        try {
            this.validatePath(filePath);
            await fs.unlink(path.resolve(filePath));
            return { success: true };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async deleteDirectory(dirPath: string): Promise<ServiceResponse> {
        try {
            this.validatePath(dirPath);
            await fs.rm(path.resolve(dirPath), { recursive: true, force: true });
            return { success: true };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async fileExists(filePath: string): Promise<{ exists: boolean }> {
        try {
            await fs.access(path.resolve(filePath));
            return { exists: true };
        } catch {
            return { exists: false };
        }
    }

    async getFileInfo(filePath: string): Promise<ServiceResponse<{ path: string; size: number; isDirectory: boolean; isFile: boolean; created: string; modified: string; accessed: string }>> {
        try {
            this.validatePath(filePath);
            const absolutePath = path.resolve(filePath);
            const stats = await fs.stat(absolutePath);
            return {
                success: true,
                data: {
                    path: absolutePath,
                    size: stats.size,
                    isDirectory: stats.isDirectory(),
                    isFile: stats.isFile(),
                    created: stats.birthtime.toISOString(),
                    modified: stats.mtime.toISOString(),
                    accessed: stats.atime.toISOString()
                }
            };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async copyFile(source: string, destination: string): Promise<ServiceResponse> {
        try {
            this.validatePath(source);
            this.validatePath(destination);
            const srcPath = path.resolve(source);
            const destPath = path.resolve(destination);
            await fs.copyFile(srcPath, destPath);
            return { success: true };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async moveFile(source: string, destination: string): Promise<ServiceResponse> {
        try {
            this.validatePath(source);
            this.validatePath(destination);
            const srcPath = path.resolve(source);
            const destPath = path.resolve(destination);
            await fs.mkdir(path.dirname(destPath), { recursive: true });
            await fs.rename(srcPath, destPath);
            return { success: true };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    // --- Extended Operations (from FileManagementService) ---

    async extractStrings(filePath: string, minLength: number = 4): Promise<ServiceResponse<{ strings: string[] }>> {
        try {
            const buffer = await fs.readFile(path.resolve(filePath));
            const strings: string[] = [];
            let current = "";
            for (let i = 0; i < buffer.length; i++) {
                const char = buffer[i];
                if (char >= 32 && char <= 126) {
                    current += String.fromCharCode(char);
                } else {
                    if (current.length >= minLength) { strings.push(current); }
                    current = "";
                }
            }
            return { success: true, data: { strings } };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    async syncNote(title: string, content: string, dir: string): Promise<ServiceResponse<{ path: string }>> {
        try {
            const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
            const fullPath = path.join(dir, fileName);
            await fs.writeFile(fullPath, content);
            return { success: true, data: { path: fullPath } };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    async unzip(zipPath: string, destPath: string): Promise<ServiceResponse> {
        try {
            this.validatePath(zipPath);
            this.validatePath(destPath);

            const { spawn } = await import('child_process');

            return new Promise((resolve) => {
                let proc;
                if (process.platform === 'win32') {
                    // Use powershell with array arguments to prevent injection
                    proc = spawn('powershell.exe', [
                        '-NoProfile',
                        '-NonInteractive',
                        '-Command',
                        'Expand-Archive',
                        '-Path',
                        zipPath,
                        '-DestinationPath',
                        destPath,
                        '-Force'
                    ]);
                } else {
                    proc = spawn('unzip', ['-o', zipPath, '-d', destPath]);
                }

                let error = '';
                proc.stderr.on('data', (data) => error += data.toString());
                proc.on('close', (code) => {
                    if (code === 0) { resolve({ success: true, message: `Extracted to ${destPath}` }); }
                    else { resolve({ success: false, error: error || `Exit code ${code}` }); }
                });
            });
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    async batchRename(dir: string, pattern: string, replacement: string): Promise<ServiceResponse> {
        try {
            this.validatePath(dir);
            const files = await fs.readdir(dir);
            let count = 0;
            for (const file of files) {
                if (file.includes(pattern)) {
                    const newName = file.replace(pattern, replacement);
                    await fs.rename(path.join(dir, file), path.join(dir, newName));
                    count++;
                }
            }
            return { success: true, message: `${count} files renamed.` };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    watchFolder(dir: string, callback?: (event: string, filename: string) => void): ServiceResponse<{ close: () => void }> {
        try {
            this.validatePath(dir);
            const absoluteDir = path.resolve(dir);
            const watcher = watch(absoluteDir, { recursive: true }, (eventType, filename) => {
                if (!filename) { return; }
                if (this.shouldIgnore(path.join(absoluteDir, filename.toString()))) { return; }

                // Debounce or just emission could be handled by caller, but basic log here
                appLogger.info('filesystem.service', `[FileWatcher] ${eventType}: ${filename}`);
                if (callback) { callback(eventType, filename.toString()); }
            });

            return {
                success: true,
                message: `Watching ${dir} for changes...`,
                data: { close: () => watcher.close() }
            };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    async downloadFile(url: string, destPath: string): Promise<ServiceResponse<{ path: string }>> {
        if (!this.isPathAllowed(destPath)) {
            return { success: false, error: 'Access denied: Path is outside allowed directories' };
        }
        return new Promise((resolve) => {
            const file = createWriteStream(destPath);
            https.get(url, (response: import('http').IncomingMessage) => {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve({ success: true, data: { path: destPath } });
                });
            }).on('error', (err: Error) => {
                fs.unlink(destPath).catch(() => { });
                resolve({ success: false, error: err.message });
            });
        });
    }

    async getFileHash(filePath: string, algorithm: 'md5' | 'sha1' | 'sha256' = 'sha256'): Promise<ServiceResponse<string>> {
        try {
            this.validatePath(filePath);
            const { createHash } = await import('crypto');
            const content = await fs.readFile(path.resolve(filePath));
            const hash = createHash(algorithm).update(content).digest('hex');
            return { success: true, data: hash };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async searchFiles(rootPath: string, pattern: string): Promise<ServiceResponse<string[]>> {
        try {
            const results: string[] = [];
            await this.searchFilesStream(rootPath, pattern, (path) => results.push(path));
            return { success: true, data: results };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async searchFilesStream(rootPath: string, pattern: string, onResult: (path: string) => void): Promise<void> {
        this.validatePath(rootPath);
        const walk = async (dir: string) => {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const full = path.join(dir, entry.name);
                    if (this.shouldIgnore(full)) { continue; }

                    if (entry.isDirectory()) {
                        await walk(full);
                    } else if (entry.name.includes(pattern)) {
                        onResult(full);
                    }
                }
            } catch {
                // Ignore access errors during search
            }
        };
        await walk(path.resolve(rootPath));
    }

    async applyEdits(filePath: string, edits: { startLine: number, endLine: number, replacement: string }[]): Promise<ServiceResponse> {
        try {
            const result = await this.readFile(filePath);
            if (!result.success || !result.data) { return { success: false, error: result.error ?? 'File read failed' }; }

            const lines = result.data.split('\n');
            const sortedEdits = [...edits].sort((a, b) => b.startLine - a.startLine);

            for (const edit of sortedEdits) {
                if (edit.startLine < 1 || edit.endLine > lines.length || edit.startLine > edit.endLine) {
                    return { success: false, error: `Invalid line range: ${edit.startLine}-${edit.endLine} (File has ${lines.length} lines)` };
                }

                const start = edit.startLine - 1;
                const count = edit.endLine - edit.startLine + 1;
                lines.splice(start, count, edit.replacement);
            }

            const newContent = lines.join('\n');
            const writeResult = await this.writeFile(filePath, newContent);
            if (!writeResult.success) {
                return { success: false, error: writeResult.error ?? 'Failed to write edited file content' };
            }
            return { success: true, message: `Applied ${edits.length} edits to ${filePath}` };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }
}
