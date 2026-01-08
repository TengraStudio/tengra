import { ServiceResponse } from '../../../shared/types';
import * as fs from 'fs/promises';
import { watch } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';
import { createWriteStream } from 'fs';

const execAsync = promisify(exec);

export class FileManagementService {
    async extractStrings(filePath: string, minLength: number = 4): Promise<ServiceResponse<{ strings: string[] }>> {
        try {
            const buffer = await fs.readFile(filePath);
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
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async syncNote(title: string, content: string, dir: string): Promise<ServiceResponse<{ path: string }>> {
        try {
            const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
            const fullPath = path.join(dir, fileName);
            await fs.writeFile(fullPath, content);
            return { success: true, result: { path: fullPath } };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async unzip(zipPath: string, destPath: string): Promise<ServiceResponse> {
        try {
            if (process.platform === 'win32') {
                await execAsync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destPath}' -Force"`);
            } else {
                await execAsync(`unzip -o "${zipPath}" -d "${destPath}"`);
            }
            return { success: true, message: `Extracted to ${destPath}` };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async batchRename(dir: string, pattern: string, replacement: string): Promise<ServiceResponse> {
        try {
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
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    watchFolder(dir: string): ServiceResponse {
        try {
            watch(dir, (eventType, filename) => {
                console.log(`Folder changed: ${eventType} on ${filename}`);
            });
            return { success: true, message: `Watching ${dir} for changes...` };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async downloadFile(url: string, destPath: string): Promise<ServiceResponse<{ path: string }>> {
        return new Promise((resolve) => {
            const file = createWriteStream(destPath);
            https.get(url, (response: any) => {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve({ success: true, result: { path: destPath } });
                });
            }).on('error', (err: any) => {
                fs.unlink(destPath).catch(() => { });
                resolve({ success: false, error: err.message });
            });
        });
    }

    async applyEdits(path: string, edits: { startLine: number, endLine: number, replacement: string }[]): Promise<ServiceResponse> {
        try {
            const content = await fs.readFile(path, 'utf8');
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
            await fs.writeFile(path, newContent, 'utf8');
            return { success: true, message: `Applied ${edits.length} edits to ${path}` };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }
}
