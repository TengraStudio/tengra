/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'crypto';
import { watch } from 'fs';
import { createWriteStream } from 'fs';
import { existsSync, lstatSync, realpathSync } from 'fs';
import * as fs from 'fs/promises';
import * as https from 'https';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { JsonObject } from '@shared/types/common';
import { AISystemType, DiffStats } from '@shared/types/file-diff';
import { ServiceResponse } from '@shared/types/index';
import { getErrorMessage } from '@shared/utils/error.util';

import type { FileChangeTracker } from './file-change-tracker.service';

type PdfParseResult = { text?: string };
type PdfParseFunction = (dataBuffer: Buffer) => Promise<PdfParseResult>;

export class FileSystemService {
    private static readonly MAX_SEARCH_DIRECTORIES = 100000;
    private allowedRoots: string[] = [];
    private readonly allowedDownloadHosts = new Set([
        'github.com',
        'raw.githubusercontent.com',
        'objects.githubusercontent.com',
        'release-assets.githubusercontent.com'
    ]);
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
        const isWin = process.platform === 'win32';
        const normalizeForComparison = (candidatePath: string): string => {
            const resolvedPath = path.resolve(candidatePath);
            return isWin ? resolvedPath.toLowerCase() : resolvedPath;
        };
        const normalizedPath = normalizeForComparison(filePath);

        return this.allowedRoots.some(root => {
            const normalizedRoot = normalizeForComparison(root);
            const relativePath = path.relative(normalizedRoot, normalizedPath);
            return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
        });
    }

    /**
     * Expands Windows environment variables in a path string.
     * Supports both %VAR% and $VAR syntax.
     * @example expandEnvVars('%USERPROFILE%/Desktop') → 'C:/Users/john/Desktop'
     */
    private expandEnvVars(inputPath: string): string {
        if (!inputPath) {
            return inputPath;
        }

        let result = inputPath;

        // Expand %VAR% syntax (Windows style)
        result = result.replace(/%([^%]+)%/g, (_match, varName: string) => {
            const value = process.env[varName] || process.env[varName.toUpperCase()];
            return value ?? `%${varName}%`;
        });

        // Expand $VAR syntax (Unix style, also works on Windows)
        result = result.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_match, varName: string) => {
            const value = process.env[varName] || process.env[varName.toUpperCase()];
            return value ?? `$${varName}`;
        });

        // Handle common shortcuts
        if (result.startsWith('~')) {
            const home = process.env.HOME || process.env.USERPROFILE || '';
            result = home + result.substring(1);
        }

        return result;
    }

    private validatePath(filePath: string) {
        const expandedPath = this.expandEnvVars(filePath);
        const absolutePath = path.resolve(expandedPath);
        if (!this.isPathAllowed(absolutePath)) {
            throw new Error(`Access denied: Path is outside allowed directories. (${filePath})`);
        }

        try {
            const absolutePathStats = lstatSync(absolutePath);
            if (absolutePathStats.isSymbolicLink()) {
                throw new Error(`Access denied: Symbolic links/junctions are not allowed. (${filePath})`);
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }

        let candidate = absolutePath;
        while (!existsSync(candidate)) {
            const parent = path.dirname(candidate);
            if (parent === candidate) {
                break;
            }
            candidate = parent;
        }

        if (!existsSync(candidate)) {
            return;
        }

        const realPath = realpathSync.native(candidate);
        if (!this.isPathAllowed(realPath)) {
            throw new Error(`Access denied: Path resolves outside allowed directories. (${filePath})`);
        }
    }

    private ignorePatterns: string[] = [];


    updateIgnorePatterns(patterns: string[]) {
        this.ignorePatterns = [...new Set([...this.ignorePatterns, ...patterns])];
    }

    private shouldIgnore(filePath: string): boolean {
        if (this.ignorePatterns.length === 0) {
            return false;
        }

        const normalizedPath = filePath.replace(/\\/g, '/');
        return this.ignorePatterns.some(pattern => {
            const normalizedPattern = pattern.replace(/\\/g, '/');
            // If the pattern starts with /, check for absolute prefix match
            if (normalizedPattern.startsWith('/')) {
                return normalizedPath.includes(normalizedPattern);
            }
            // Otherwise check for segment match (e.g. "node_modules")
            return normalizedPath.split('/').includes(normalizedPattern) ||
                   normalizedPath.includes(`/${normalizedPattern}/`) ||
                   normalizedPath.endsWith(`/${normalizedPattern}`);
        });
    }

    // --- Core Operations ---

    async readFile(filePath: string): Promise<ServiceResponse<string>> {
        try {
            const expandedPath = this.expandEnvVars(filePath);
            this.validatePath(expandedPath);
            const absolutePath = path.resolve(expandedPath);

            const stats = await fs.stat(absolutePath);
            if (stats.size > 50 * 1024 * 1024) {
                return { success: false, error: `File too large (max 50MB): ${filePath}` };
            }

            const content = await fs.readFile(absolutePath);

            // UTF-16 LE BOM detection (common on Windows/PowerShell)
            if (content.length >= 2 && content[0] === 0xFF && content[1] === 0xFE) {
                return { success: true, data: content.toString('utf16le').replace(/^\uFEFF/, '') };
            }

            return { success: true, data: content.toString('utf-8').split('\0').join('') };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async readImage(filePath: string): Promise<ServiceResponse<string>> {
        try {
            const expandedPath = this.expandEnvVars(filePath);
            this.validatePath(expandedPath);
            const absolutePath = path.resolve(expandedPath); 
            const buffer = await fs.readFile(absolutePath);
            const base64 = buffer.toString('base64');

            // Determine mime type from extension
            const ext = path.extname(absolutePath).toLowerCase();
            let mime = 'image/jpeg';
            if (ext === '.png') {
                mime = 'image/png';
            }
            if (ext === '.gif') {
                mime = 'image/gif';
            }
            if (ext === '.webp') {
                mime = 'image/webp';
            }
            if (ext === '.svg') {
                mime = 'image/svg+xml';
            }

            return { success: true, data: `data:${mime};base64,${base64}` };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async isBinaryFile(filePath: string): Promise<boolean> {
        try {
            const expandedPath = this.expandEnvVars(filePath);
            this.validatePath(expandedPath);
            const absolutePath = path.resolve(expandedPath);
            const stats = await fs.stat(absolutePath);
            if (stats.size === 0) {
                return false;
            }

            const handle = await fs.open(absolutePath, 'r');
            try {
                const buffer = Buffer.alloc(Math.min(stats.size, 1024));
                await handle.read(buffer, 0, buffer.length, 0);
                return buffer.includes(0);
            } finally {
                await handle.close();
            }
        } catch {
            return false;
        }
    }

    async readPdf(filePath: string): Promise<{ success: boolean; text?: string; error?: string }> {
        try {
            const expandedPath = this.expandEnvVars(filePath);
            this.validatePath(expandedPath);
            const absolutePath = path.resolve(expandedPath);
            const pdfBuffer = await fs.readFile(absolutePath);
            const pdfParseModule = (await import('pdf-parse')).default as PdfParseFunction;
            const parsed = await pdfParseModule(pdfBuffer);
            const text = parsed.text?.trim() ?? '';

            if (!text) {
                return { success: false, error: 'The selected PDF did not contain readable text.' };
            }

            return { success: true, text };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async writeFile(filePath: string, content: string): Promise<ServiceResponse> {
        try {
            const expandedPath = this.expandEnvVars(filePath);
            this.validatePath(expandedPath);
            const absolutePath = path.resolve(expandedPath);
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
            aiSystem: AISystemType;
            chatSessionId?: string;
            changeReason?: string;
            metadata?: JsonObject;
        }
    ): Promise<ServiceResponse> {
        try {
            const expandedPath = this.expandEnvVars(filePath);
            this.validatePath(expandedPath);
            const absolutePath = path.resolve(expandedPath);

            // Get current content if file exists
            let beforeContent = '';
            let existedBefore = false;
            try {
                beforeContent = await fs.readFile(absolutePath, 'utf-8');
                existedBefore = true;
            } catch {
                // File doesn't exist, beforeContent stays empty
            }

            // Write the new content
            const dir = path.dirname(absolutePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(absolutePath, content, 'utf-8');

            // Track the change if tracker is available
            let diffId: string | undefined;
            let diffStats: DiffStats | undefined;
            if (this.fileChangeTracker) {
                const diff = await this.fileChangeTracker.trackFileChange(
                    absolutePath,
                    beforeContent,
                    content,
                    {
                        ...context,
                        metadata: {
                            ...(context.metadata ?? {}),
                            existedBefore,
                        },
                    }
                );
                if (diff) {
                    diffId = diff.id;
                    diffStats = this.fileChangeTracker.getDiffStats(diff.diffContent);
                }
            }

            return {
                success: true,
                details: {
                    diffId: diffId ?? '',
                    additions: diffStats?.additions ?? 0,
                    deletions: diffStats?.deletions ?? 0,
                    changes: diffStats?.changes ?? 0,
                    existedBefore,
                    path: absolutePath,
                },
            };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async deleteFileWithTracking(
        filePath: string,
        context: {
            aiSystem: AISystemType;
            chatSessionId?: string;
            changeReason?: string;
            metadata?: JsonObject;
        }
    ): Promise<ServiceResponse> {
        try {
            const expandedPath = this.expandEnvVars(filePath);
            this.validatePath(expandedPath);
            const absolutePath = path.resolve(expandedPath);

            let beforeContent = '';
            let existedBefore = false;
            try {
                beforeContent = await fs.readFile(absolutePath, 'utf-8');
                existedBefore = true;
            } catch {
                // If it doesn't exist, treat as no-op.
            }

            await fs.unlink(absolutePath);

            let diffId: string | undefined;
            let diffStats: DiffStats | undefined;
            if (this.fileChangeTracker) {
                const diff = await this.fileChangeTracker.trackFileChange(
                    absolutePath,
                    beforeContent,
                    '',
                    {
                        ...context,
                        metadata: {
                            ...(context.metadata ?? {}),
                            operation: 'delete',
                            existedBefore,
                        },
                    }
                );
                if (diff) {
                    diffId = diff.id;
                    diffStats = this.fileChangeTracker.getDiffStats(diff.diffContent);
                }
            }

            return {
                success: true,
                details: {
                    diffId: diffId ?? '',
                    additions: diffStats?.additions ?? 0,
                    deletions: diffStats?.deletions ?? 0,
                    changes: diffStats?.changes ?? 0,
                    existedBefore,
                    path: absolutePath,
                },
            };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async applyEditsWithTracking(
        filePath: string,
        edits: { startLine: number; endLine: number; replacement: string }[],
        context: {
            aiSystem: AISystemType;
            chatSessionId?: string;
            changeReason?: string;
            metadata?: JsonObject;
        }
    ): Promise<ServiceResponse> {
        try {
            const result = await this.readFile(filePath);
            if (!result.success || !result.data) {
                return { success: false, error: result.error ?? 'File read failed' };
            }

            const lines = result.data.split('\n');
            const sortedEdits = [...edits].sort((a, b) => b.startLine - a.startLine);

            for (const edit of sortedEdits) {
                if (
                    edit.startLine < 1 ||
                    edit.endLine > lines.length ||
                    edit.startLine > edit.endLine
                ) {
                    return {
                        success: false,
                        error: `Invalid line range: ${edit.startLine}-${edit.endLine} (File has ${lines.length} lines)`,
                    };
                }

                const start = edit.startLine - 1;
                const count = edit.endLine - edit.startLine + 1;
                lines.splice(start, count, edit.replacement);
            }

            const newContent = lines.join('\n');
            const writeResult = await this.writeFileWithTracking(filePath, newContent, context);
            if (!writeResult.success) {
                return {
                    success: false,
                    error: writeResult.error ?? 'Failed to write edited file content',
                };
            }
            return {
                success: true,
                message: `Applied ${edits.length} edits to ${filePath}`,
                details: writeResult.details,
            };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    async listDirectory(
        dirPath: string
    ): Promise<
        ServiceResponse<
            Array<{ name: string; isDirectory: boolean; size?: number; modified?: string }>
        >
    > {
        try {
            const expandedPath = this.expandEnvVars(dirPath);
            this.validatePath(expandedPath);
            const absolutePath = path.resolve(expandedPath);
            const entries = await fs.readdir(absolutePath, { withFileTypes: true });
            const filteredEntries = entries.filter(entry => {
                const entryPath = path.join(absolutePath, entry.name);
                return !this.shouldIgnore(entryPath);
            });
            const files = filteredEntries.map(entry => ({
                name: entry.name,
                isDirectory: entry.isDirectory(),
            }));
            return { success: true, data: files };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async createDirectory(dirPath: string): Promise<ServiceResponse> {
        try {
            const expandedPath = this.expandEnvVars(dirPath);
            this.validatePath(expandedPath);
            const absolutePath = path.resolve(expandedPath);
            await fs.mkdir(absolutePath, { recursive: true });
            return { success: true };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async deleteFile(filePath: string): Promise<ServiceResponse> {
        try {
            const expandedPath = this.expandEnvVars(filePath);
            this.validatePath(expandedPath);
            await fs.unlink(path.resolve(expandedPath));
            return { success: true };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async deleteDirectory(dirPath: string): Promise<ServiceResponse> {
        try {
            const expandedPath = this.expandEnvVars(dirPath);
            this.validatePath(expandedPath);
            await fs.rm(path.resolve(expandedPath), { recursive: true, force: true });
            return { success: true };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async fileExists(filePath: string): Promise<{ exists: boolean }> {
        try {
            const expandedPath = this.expandEnvVars(filePath);
            this.validatePath(expandedPath);
            await fs.access(path.resolve(expandedPath));
            return { exists: true };
        } catch {
            return { exists: false };
        }
    }

    async getFileInfo(filePath: string): Promise<
        ServiceResponse<{
            path: string;
            size: number;
            isDirectory: boolean;
            isFile: boolean;
            created: string;
            modified: string;
            accessed: string;
        }>
    > {
        try {
            const expandedPath = this.expandEnvVars(filePath);
            this.validatePath(expandedPath);
            const absolutePath = path.resolve(expandedPath);
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
                    accessed: stats.atime.toISOString(),
                },
            };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async copyFile(source: string, destination: string): Promise<ServiceResponse> {
        try {
            const expandedSource = this.expandEnvVars(source);
            const expandedDest = this.expandEnvVars(destination);
            this.validatePath(expandedSource);
            this.validatePath(expandedDest);
            const srcPath = path.resolve(expandedSource);
            const destPath = path.resolve(expandedDest);
            await fs.mkdir(path.dirname(destPath), { recursive: true });
            await fs.copyFile(srcPath, destPath);
            return { success: true };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async copyPath(source: string, destination: string): Promise<ServiceResponse> {
        try {
            const expandedSource = this.expandEnvVars(source);
            const expandedDest = this.expandEnvVars(destination);
            this.validatePath(expandedSource);
            this.validatePath(expandedDest);
            const sourcePath = path.resolve(expandedSource);
            const destinationPath = path.resolve(expandedDest);
            const sourceStats = await fs.stat(sourcePath);
            await fs.mkdir(path.dirname(destinationPath), { recursive: true });

            if (sourceStats.isDirectory()) {
                await fs.cp(sourcePath, destinationPath, {
                    recursive: true,
                    force: true,
                });
            } else {
                await fs.copyFile(sourcePath, destinationPath);
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async moveFile(source: string, destination: string): Promise<ServiceResponse> {
        try {
            const expandedSource = this.expandEnvVars(source);
            const expandedDest = this.expandEnvVars(destination);
            this.validatePath(expandedSource);
            this.validatePath(expandedDest);
            const srcPath = path.resolve(expandedSource);
            const destPath = path.resolve(expandedDest);
            await fs.mkdir(path.dirname(destPath), { recursive: true });
            await fs.rename(srcPath, destPath);
            return { success: true };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    // --- Extended Operations (from FileManagementService) ---

    async extractStrings(
        filePath: string,
        minLength: number = 4
    ): Promise<ServiceResponse<{ strings: string[] }>> {
        try {
            const expandedPath = this.expandEnvVars(filePath);
            this.validatePath(expandedPath);
            const buffer = await fs.readFile(path.resolve(expandedPath));
            const strings: string[] = [];
            let current = '';
            for (let i = 0; i < buffer.length; i++) {
                const char = buffer[i];
                if (char >= 32 && char <= 126) {
                    current += String.fromCharCode(char);
                } else {
                    if (current.length >= minLength) {
                        strings.push(current);
                    }
                    current = '';
                }
            }
            return { success: true, data: { strings } };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    async syncNote(
        title: string,
        content: string,
        dir: string
    ): Promise<ServiceResponse<{ path: string }>> {
        try {
            const expandedDir = this.expandEnvVars(dir);
            this.validatePath(expandedDir);
            const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
            const fullPath = path.join(dir, fileName);
            this.validatePath(fullPath);
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

            return new Promise(resolve => {
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
                        '-Force',
                    ]);
                } else {
                    proc = spawn('unzip', ['-o', zipPath, '-d', destPath]);
                }

                let error = '';
                proc.stderr.on('data', data => (error += data.toString()));
                proc.on('close', code => {
                    if (code === 0) {
                        resolve({ success: true, message: `Extracted to ${destPath}` });
                    } else {
                        resolve({ success: false, error: error || `Exit code ${code}` });
                    }
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

    watchFolder(
        dir: string,
        callback?: (event: string, filename: string) => void
    ): ServiceResponse<{ close: () => void }> {
        try {
            this.validatePath(dir);
            const absoluteDir = path.resolve(dir);
            const watcher = watch(absoluteDir, { recursive: true }, (eventType, filename) => {
                if (!filename) {
                    return;
                }
                if (this.shouldIgnore(path.join(absoluteDir, filename.toString()))) {
                    return;
                }

                // Debounce or just emission could be handled by caller, but basic log here
                appLogger.info('filesystem.service', `[FileWatcher] ${eventType}: ${filename}`);
                if (callback) {
                    callback(eventType, filename.toString());
                }
            });

            return {
                success: true,
                message: `Watching ${dir} for changes...`,
                data: { close: () => watcher.close() },
            };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    async downloadFile(
        url: string,
        destPath: string,
        options?: { checksum?: string; algorithm?: 'sha256' | 'sha1' | 'md5' }
    ): Promise<ServiceResponse<{ path: string }>> {
        try {
            this.validatePath(destPath);
            const parsedUrl = new URL(url);
            if (parsedUrl.protocol !== 'https:') {
                return { success: false, error: 'Only https downloads are allowed' };
            }
            if (!this.allowedDownloadHosts.has(parsedUrl.hostname.toLowerCase())) {
                return { success: false, error: 'Download source is not allowed' };
            }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
        return new Promise(resolve => {
            const file = createWriteStream(destPath);
            https
                .get(url, (response: import('http').IncomingMessage) => {
                    if (response.statusCode && response.statusCode >= 400) {
                        void fs.unlink(destPath).catch(error => {
                            appLogger.warn(
                                'FileSystemService',
                                `Failed to clean up download target after HTTP error: ${getErrorMessage(error)}`
                            );
                        });
                        resolve({ success: false, error: `Download failed with status ${response.statusCode}` });
                        return;
                    }
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        if (options?.checksum) {
                            fs.readFile(destPath).then((content) => {
                                const algorithm = options.algorithm ?? 'sha256';
                                const digest = createHash(algorithm).update(content).digest('hex');
                                if (digest.toLowerCase() !== options.checksum?.toLowerCase()) {
                                    void fs.unlink(destPath).catch(error => {
                                        appLogger.warn(
                                            'FileSystemService',
                                            `Failed to clean up download target after checksum mismatch: ${getErrorMessage(error)}`
                                        );
                                    });
                                    resolve({ success: false, error: 'Checksum validation failed' });
                                    return;
                                }
                                resolve({ success: true, data: { path: destPath } });
                            }).catch((error) => {
                                resolve({ success: false, error: getErrorMessage(error as Error) });
                            });
                            return;
                        }
                        resolve({ success: true, data: { path: destPath } });
                    });
                })
                .on('error', (err: Error) => {
                    void fs.unlink(destPath).catch(error => {
                        appLogger.warn(
                            'FileSystemService',
                            `Failed to clean up download target after network error: ${getErrorMessage(error)}`
                        );
                    });
                    resolve({ success: false, error: err.message });
                });
        });
    }

    async getFileHash(
        filePath: string,
        algorithm: 'md5' | 'sha1' | 'sha256' = 'sha256'
    ): Promise<ServiceResponse<string>> {
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

    async searchFiles(
        rootPath: string,
        pattern: string,
        maxResults = Number.POSITIVE_INFINITY
    ): Promise<ServiceResponse<string[]>> {
        try {
            const results: string[] = [];
            await this.searchFilesStream(rootPath, pattern, path => results.push(path), maxResults);
            return { success: true, data: results };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async searchFilesStream(
        rootPath: string,
        pattern: string,
        onResult: (path: string) => void,
        maxResults = Number.POSITIVE_INFINITY
    ): Promise<void> {
        this.validatePath(rootPath);
        const directories = [path.resolve(rootPath)];
        const resultLimit = Number.isFinite(maxResults)
            ? Math.max(1, Math.floor(maxResults))
            : Number.POSITIVE_INFINITY;
        let resultCount = 0;

        for (
            let visitedDirectories = 0;
            directories.length > 0 &&
                visitedDirectories < FileSystemService.MAX_SEARCH_DIRECTORIES &&
                resultCount < resultLimit;
            visitedDirectories += 1
        ) {
            const dir = directories.pop();
            if (!dir) {
                break;
            }
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const full = path.join(dir, entry.name);
                    if (this.shouldIgnore(full)) {
                        continue;
                    }

                    if (entry.isDirectory()) {
                        directories.push(full);
                        continue;
                    }
                    if (!entry.name.includes(pattern)) {
                        continue;
                    }

                    onResult(full);
                    resultCount += 1;
                    if (resultCount >= resultLimit) {
                        break;
                    }
                }
            } catch {
                // Ignore access errors during search
            }
        }
    }

    async applyEdits(
        filePath: string,
        edits: { startLine: number; endLine: number; replacement: string }[]
    ): Promise<ServiceResponse> {
        try {
            const result = await this.readFile(filePath);
            if (!result.success || !result.data) {
                return { success: false, error: result.error ?? 'File read failed' };
            }

            const lines = result.data.split('\n');
            const sortedEdits = [...edits].sort((a, b) => b.startLine - a.startLine);

            for (const edit of sortedEdits) {
                if (
                    edit.startLine < 1 ||
                    edit.endLine > lines.length ||
                    edit.startLine > edit.endLine
                ) {
                    return {
                        success: false,
                        error: `Invalid line range: ${edit.startLine}-${edit.endLine} (File has ${lines.length} lines)`,
                    };
                }

                const start = edit.startLine - 1;
                const count = edit.endLine - edit.startLine + 1;
                lines.splice(start, count, edit.replacement);
            }

            const newContent = lines.join('\n');
            const writeResult = await this.writeFile(filePath, newContent);
            if (!writeResult.success) {
                return {
                    success: false,
                    error: writeResult.error ?? 'Failed to write edited file content',
                };
            }
            return { success: true, message: `Applied ${edits.length} edits to ${filePath}` };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }
}

