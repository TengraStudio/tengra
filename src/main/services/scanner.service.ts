import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getErrorMessage } from '@shared/utils/error.util';

import { JsonValue } from '@shared/types/common';
export interface ScanResult {
    path: string;
    content: string;
    chunks: string[];
    [key: string]: JsonValue | undefined;
}

export class ScannerService {
    private ignoreList: string[] = [
        'node_modules',
        '.git',
        'dist',
        'build',
        '.next',
        '.vscode',
        'package-lock.json',
        'yarn.lock',
        '.DS_Store'
    ];

    private allowedExtensions: string[] = [
        '.ts', '.tsx', '.js', '.jsx', '.md', '.py', '.go', '.rs', '.java', '.cpp', '.h', '.css', '.html', '.json'
    ];

    constructor() { }

    async scanDirectory(dirPath: string): Promise<ScanResult[]> {
        const results: ScanResult[] = [];
        await this.walk(dirPath, results);
        return results;
    }

    private async walk(dir: string, results: ScanResult[]) {
        const files = await fs.readdir(dir, { withFileTypes: true });

        for (const file of files) {
            const fullPath = path.join(dir, file.name);

            if (file.isDirectory()) {
                if (this.ignoreList.includes(file.name)) continue;
                await this.walk(fullPath, results);
            } else {
                const ext = path.extname(file.name).toLowerCase();
                if (this.allowedExtensions.includes(ext)) {
                    try {
                        const content = await fs.readFile(fullPath, 'utf8');
                        if (content.length > 0) {
                            results.push({
                                path: fullPath,
                                content,
                                chunks: this.chunkText(content)
                            });
                        }
                    } catch (e) {
                        console.error(`Error reading file ${fullPath}:`, getErrorMessage(e as Error));
                    }
                }
            }
        }
    }

    private chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
        const chunks: string[] = [];
        let start = 0;

        if (text.length <= chunkSize) {
            return [text];
        }

        while (start < text.length) {
            const end = start + chunkSize;
            chunks.push(text.slice(start, end));
            start += (chunkSize - overlap);
        }

        return chunks;
    }
}
