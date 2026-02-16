import { spawn } from 'child_process';
import { watch } from 'fs';
import { createWriteStream } from 'fs';
import * as fs from 'fs/promises';
import * as https from 'https';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { ServiceResponse } from '@shared/types';
import { getErrorMessage } from '@shared/utils/error.util';
import { app } from 'electron';

export class FileManagementService {
    private readonly maxReadBytes = 10 * 1024 * 1024;
    private readonly maxWriteBytes = 10 * 1024 * 1024;
    private readonly maxDownloadBytes = 100 * 1024 * 1024;
    private readonly allowedTextExtensions = new Set(['.md', '.txt', '.json', '.ts', '.tsx', '.js', '.jsx', '.yaml', '.yml', '.xml', '.html', '.css', '.scss']);

    private sanitizePath(input: string): string {
        if (!input || input.includes('\0')) {
            throw new Error('Invalid path input');
        }
        return path.resolve(input);
    }

    private ensureAllowedFileType(filePath: string): void {
        const ext = path.extname(filePath).toLowerCase();
        if (ext && !this.allowedTextExtensions.has(ext)) {
            throw new Error(`File type not allowed for this operation: ${ext}`);
        }
    }

    private async ensureSizeWithinLimit(filePath: string, maxBytes: number): Promise<void> {
        const stat = await fs.stat(filePath);
        if (stat.size > maxBytes) {
            throw new Error(`File exceeds size limit (${stat.size} > ${maxBytes})`);
        }
    }

    private async quarantineFile(filePath: string, reason: string): Promise<void> {
        try {
            const quarantineRoot = path.join(app.getPath('userData'), 'quarantine');
            await fs.mkdir(quarantineRoot, { recursive: true });
            const fileName = `${Date.now()}-${path.basename(filePath)}`;
            const destination = path.join(quarantineRoot, fileName);
            await fs.rename(filePath, destination);
            appLogger.warn('file.service', `File quarantined: ${destination} (${reason})`);
        } catch (error) {
            appLogger.warn('file.service', `Failed to quarantine file ${filePath}: ${getErrorMessage(error as Error)}`);
        }
    }

    async extractStrings(filePath: string, minLength: number = 4): Promise<ServiceResponse<{ strings: string[] }>> {
        try {
            const safePath = this.sanitizePath(filePath);
            await this.ensureSizeWithinLimit(safePath, this.maxReadBytes);
            const buffer = await fs.readFile(safePath);
            const strings: string[] = [];
            let current = "";
            for (let i = 0; i < buffer.length; i++) {
                const char = buffer[i];
                if (char >= 32 && char <= 126) {
                    current += String.fromCharCode(char);
                } else {
                    if (current.length >= minLength) {
                        strings.push(current);
                    }
                    current = "";
                }
            }
            return { success: true, result: { strings: strings } };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    async syncNote(title: string, content: string, dir: string): Promise<ServiceResponse<{ path: string }>> {
        try {
            const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
            const safeDir = this.sanitizePath(dir);
            const fullPath = path.join(safeDir, fileName);
            const payloadSize = Buffer.byteLength(content, 'utf8');
            if (payloadSize > this.maxWriteBytes) {
                throw new Error(`Content exceeds size limit (${payloadSize} > ${this.maxWriteBytes})`);
            }
            await fs.writeFile(fullPath, content);
            return { success: true, result: { path: fullPath } };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    async unzip(zipPath: string, destPath: string): Promise<ServiceResponse> {
        try {
            const safeZipPath = this.sanitizePath(zipPath);
            const safeDestPath = this.sanitizePath(destPath);
            if (process.platform === 'win32') {
                await this.runProcess('powershell', [
                    '-NoProfile',
                    '-NonInteractive',
                    '-Command',
                    'Expand-Archive',
                    '-LiteralPath',
                    safeZipPath,
                    '-DestinationPath',
                    safeDestPath,
                    '-Force',
                ]);
            } else {
                await this.runProcess('unzip', ['-o', safeZipPath, '-d', safeDestPath]);
            }
            return { success: true, message: `Extracted to ${safeDestPath}` };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    async batchRename(dir: string, pattern: string, replacement: string): Promise<ServiceResponse> {
        try {
            const safeDir = this.sanitizePath(dir);
            const files = await fs.readdir(safeDir);
            let count = 0;
            for (const file of files) {
                if (file.includes(pattern)) {
                    const newName = file.replace(pattern, replacement);
                    await fs.rename(path.join(safeDir, file), path.join(safeDir, newName));
                    count++;
                }
            }
            return { success: true, message: `${count} files renamed.` };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    watchFolder(dir: string): ServiceResponse {
        try {
            const safeDir = this.sanitizePath(dir);
            watch(safeDir, (eventType, filename) => {
                appLogger.info('file.service', `Folder changed: ${eventType} on ${filename}`);
            });
            return { success: true, message: `Watching ${safeDir} for changes...` };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    async downloadFile(url: string, destPath: string): Promise<ServiceResponse<{ path: string }>> {
        return new Promise((resolve) => {
            let safeDestPath: string;
            try {
                safeDestPath = this.sanitizePath(destPath);
            } catch (error) {
                resolve({ success: false, error: getErrorMessage(error as Error) });
                return;
            }

            const file = createWriteStream(safeDestPath);
            let receivedBytes = 0;
            https.get(url, (response) => {
                const contentLength = Number(response.headers['content-length'] ?? 0);
                if (contentLength > this.maxDownloadBytes) {
                    response.destroy();
                    void this.quarantineFile(safeDestPath, 'download-size-limit');
                    resolve({ success: false, error: 'Remote file exceeds download size limit' });
                    return;
                }
                response.on('data', chunk => {
                    receivedBytes += chunk.length;
                    if (receivedBytes > this.maxDownloadBytes) {
                        response.destroy(new Error('Download exceeded size limit'));
                    }
                });
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve({ success: true, result: { path: safeDestPath } });
                });
            }).on('error', (err) => {
                fs.unlink(safeDestPath).catch(() => { /* ignore */ });
                resolve({ success: false, error: err.message });
            });
        });
    }

    async applyEdits(filePath: string, edits: { startLine: number, endLine: number, replacement: string }[]): Promise<ServiceResponse> {
        try {
            const safeFilePath = this.sanitizePath(filePath);
            this.ensureAllowedFileType(safeFilePath);
            await this.ensureSizeWithinLimit(safeFilePath, this.maxReadBytes);
            const content = await fs.readFile(safeFilePath, 'utf8');
            const lines = content.split('\n');
            const sortedEdits = [...edits].sort((a, b) => b.startLine - a.startLine); // Apply from bottom to top to preserve indices

            for (const edit of sortedEdits) {
                if (edit.startLine < 1 || edit.endLine > lines.length || edit.startLine > edit.endLine) {
                    return { success: false, error: `Invalid line range: ${edit.startLine}-${edit.endLine} (File has ${lines.length} lines)` };
                }

                // 1-based index to 0-based
                const start = edit.startLine - 1;
                const count = edit.endLine - edit.startLine + 1;

                // Handle indentation preservation if needed, or just raw replacement
                // For surgical edits, we usually assume the agent provides formatted code or we just insert.
                // Improvement: detect indentation of startLine and apply to replacement if it lacks it? 
                // For now, raw replacement is safer and more predictable for the agent.

                lines.splice(start, count, edit.replacement);
            }

            const newContent = lines.join('\n');
            const newSize = Buffer.byteLength(newContent, 'utf8');
            if (newSize > this.maxWriteBytes) {
                throw new Error(`Edited content exceeds size limit (${newSize} > ${this.maxWriteBytes})`);
            }
            await fs.writeFile(safeFilePath, newContent, 'utf8');
            return { success: true, message: `Applied ${edits.length} edits to ${safeFilePath}` };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    private async runProcess(command: string, args: string[]): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            const proc = spawn(command, args, { shell: false });
            let stderr = '';

            proc.stderr.on('data', (chunk: Buffer | string) => {
                stderr += chunk.toString();
            });
            proc.on('error', reject);
            proc.on('close', code => {
                if (code === 0) {
                    resolve();
                    return;
                }
                reject(new Error(stderr.trim() || `${command} exited with code ${code ?? 'unknown'}`));
            });
        });
    }
}
