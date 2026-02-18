import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

import { getErrorMessage } from '@shared/utils/error.util';

const execFileAsync = promisify(execFile);

export class GitService {
    private tokenizeCommand(command: string): string[] {
        const tokens: string[] = [];
        let current = '';
        let inSingle = false;
        let inDouble = false;
        let escaping = false;

        for (const char of command) {
            if (escaping) {
                current += char;
                escaping = false;
                continue;
            }

            if (char === '\\' && inDouble) {
                escaping = true;
                continue;
            }

            if (char === '\'' && !inDouble) {
                inSingle = !inSingle;
                continue;
            }

            if (char === '"' && !inSingle) {
                inDouble = !inDouble;
                continue;
            }

            if (/\s/.test(char) && !inSingle && !inDouble) {
                if (current.length > 0) {
                    tokens.push(current);
                    current = '';
                }
                continue;
            }

            current += char;
        }

        if (current.length > 0) {
            tokens.push(current);
        }
        return tokens;
    }

    private async executeArgs(args: string[], cwd: string) {
        try {
            const { stdout, stderr } = await execFileAsync('git', args, { cwd, shell: false, maxBuffer: 10 * 1024 * 1024 });
            return { success: true, stdout, stderr };
        } catch (error) {
            return { success: false, error: getErrorMessage(error) };
        }
    }

    private async execute(command: string, cwd: string) {
        const args = this.tokenizeCommand(command);
        return await this.executeArgs(args, cwd);
    }

    async getStatus(cwd: string): Promise<{ path: string, status: string }[]> {
        const { stdout } = await this.execute('status --short', cwd);
        if (!stdout) { return []; }

        return stdout.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const status = line.substring(0, 2);
                const path = line.substring(3);
                return { path, status };
            });
    }

    async add(cwd: string, files: string = '.') {
        return await this.executeArgs(['add', '--', files], cwd);
    }

    async commit(cwd: string, message: string) {
        return await this.executeArgs(['commit', '-m', message], cwd);
    }

    async push(cwd: string, remote: string = 'origin', branch: string = 'main') {
        return await this.executeArgs(['push', remote, branch], cwd);
    }

    async pull(cwd: string) {
        return await this.execute('pull', cwd);
    }

    async getLog(cwd: string, count: number = 10) {
        const safeCwd = cwd?.trim();
        if (!safeCwd) {
            return [];
        }

        const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 10;
        const { stdout } = await this.executeArgs(['log', '-n', `${safeCount}`, '--pretty=format:%h|%s|%an|%cI'], safeCwd);
        if (!stdout) { return []; }

        return stdout.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [hash = '', message = '', author = '', date = ''] = line.split('|');
                if (!hash || !date) {
                    return null;
                }
                return { hash, message, author, date };
            })
            .filter((entry): entry is { hash: string; message: string; author: string; date: string } => entry !== null);
    }

    async getBranches(cwd: string) {
        return await this.execute('branch', cwd);
    }

    async checkout(cwd: string, branch: string) {
        return await this.executeArgs(['checkout', branch], cwd);
    }

    async executeRaw(cwd: string, command: string) {
        return await this.execute(command, cwd);
    }

    async getFileDiff(cwd: string, filePath: string, staged: boolean = false): Promise<{ original: string; modified: string; success: boolean; error?: string }> {
        try {
            const command = staged ? `diff --cached -- "${filePath}"` : `diff -- "${filePath}"`;
            const result = await this.execute(command, cwd);

            if (!result.success || !result.stdout) {
                return await this.getFallbackDiff(cwd, filePath, staged);
            }

            return this.parseUnifiedDiff(result.stdout);
        } catch (error) {
            return { original: '', modified: '', success: false, error: getErrorMessage(error) };
        }
    }

    private async getFallbackDiff(cwd: string, filePath: string, staged: boolean): Promise<{ original: string; modified: string; success: boolean }> {
        if (staged) {
            const contentResult = await this.execute(`show : "${filePath}"`, cwd);
            if (contentResult.success && contentResult.stdout) {
                return { original: '', modified: contentResult.stdout, success: true };
            }
        }

        const fullPath = join(cwd, filePath);
        try {
            const currentContent = await fs.readFile(fullPath, 'utf8');
            const headResult = await this.execute(`show HEAD: "${filePath}"`, cwd);

            return {
                original: (headResult.success && headResult.stdout) ? headResult.stdout : '',
                modified: currentContent,
                success: true
            };
        } catch {
            return { original: '', modified: '', success: false };
        }
    }

    private parseUnifiedDiff(stdout: string): { original: string; modified: string; success: boolean } {
        const lines = stdout.split('\n');
        let original = '';
        let modified = '';
        let isContent = false;

        for (const line of lines) {
            if (line.startsWith('@@')) {
                isContent = true;
                continue;
            }
            if (!isContent || line.startsWith('---') || line.startsWith('+++')) {
                continue;
            }

            const { o, m } = this.processDiffLine(line);
            original += o;
            modified += m;
        }

        return { original: original.trim(), modified: modified.trim(), success: true };
    }

    private processDiffLine(line: string): { o: string, m: string } {
        if (line.startsWith('-') && !line.startsWith('--')) {
            return { o: line.substring(1) + '\n', m: '' };
        } else if (line.startsWith('+') && !line.startsWith('++')) {
            return { o: '', m: line.substring(1) + '\n' };
        } else if (line.startsWith(' ')) {
            const context = line.substring(1) + '\n';
            return { o: context, m: context };
        }
        return { o: '', m: '' };
    }

    async getUnifiedDiff(cwd: string, filePath: string, staged: boolean = false): Promise<{ diff: string; success: boolean; error?: string }> {
        try {
            const command = staged ? `diff --cached -- "${filePath}"` : `diff -- "${filePath}"`;

            const { stdout, stderr, success } = await this.execute(command, cwd);

            if (!success && stderr && !stdout) {
                // File might be newly added - return empty diff for now
                return { diff: '', success: true };
            }

            return { diff: stdout ?? '', success: true };
        } catch (error) {
            return { diff: '', success: false, error: getErrorMessage(error) };
        }
    }

    async stageFile(cwd: string, filePath: string) {
        return await this.executeArgs(['add', '--', filePath], cwd);
    }

    async unstageFile(cwd: string, filePath: string) {
        return await this.executeArgs(['reset', 'HEAD', '--', filePath], cwd);
    }

    async getCommitDiff(cwd: string, hash: string): Promise<{ diff: string; success: boolean; error?: string }> {
        try {
            const { stdout, stderr, success } = await this.execute(`show ${hash}`, cwd);
            if (!success && stderr && !stdout) {
                return { diff: '', success: false, error: stderr };
            }
            return { diff: stdout ?? '', success: true };
        } catch (error) {
            return { diff: '', success: false, error: getErrorMessage(error) };
        }
    }
}
