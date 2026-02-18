import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';

import { getErrorMessage } from '@shared/utils/error.util';

interface GitExecutionOptions {
    timeoutMs?: number;
    operationId?: string;
}

interface GitExecutionResult {
    success: boolean;
    stdout?: string;
    stderr?: string;
    error?: string;
    timedOut?: boolean;
    cancelled?: boolean;
    lockRecoveryGuidance?: string;
}

export class GitService {
    private readonly DEFAULT_TIMEOUT_MS = 60000;
    private readonly MIN_TIMEOUT_MS = 1000;
    private readonly MAX_TIMEOUT_MS = 600000;
    private readonly activeOperations = new Map<string, AbortController>();

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

    private normalizeTimeoutMs(timeoutMs?: number): number {
        if (!Number.isFinite(timeoutMs)) {
            return this.DEFAULT_TIMEOUT_MS;
        }
        const normalizedTimeout = Math.trunc(timeoutMs ?? this.DEFAULT_TIMEOUT_MS);
        return Math.max(this.MIN_TIMEOUT_MS, Math.min(normalizedTimeout, this.MAX_TIMEOUT_MS));
    }

    private getRepositoryLockGuidance(cwd: string): string {
        const lockPath = join(cwd, '.git', 'index.lock');
        return [
            'Repository appears locked by another Git process.',
            '1) Ensure no Git command is still running for this repo.',
            `2) If no process is running, remove lock file: ${lockPath}`,
            '3) Retry the operation.',
        ].join(' ');
    }

    private decorateGitError(error: string, cwd: string): Pick<GitExecutionResult, 'error' | 'lockRecoveryGuidance'> {
        const looksLikeLockError =
            error.includes('index.lock') ||
            error.includes('Unable to create') ||
            error.includes('could not lock');

        if (!looksLikeLockError) {
            return { error };
        }

        const lockRecoveryGuidance = this.getRepositoryLockGuidance(cwd);
        return {
            error: `${error} ${lockRecoveryGuidance}`,
            lockRecoveryGuidance,
        };
    }

    cancelOperation(operationId: string): boolean {
        const normalizedOperationId = operationId.trim();
        if (!normalizedOperationId) {
            return false;
        }
        const controller = this.activeOperations.get(normalizedOperationId);
        if (!controller) {
            return false;
        }
        controller.abort();
        this.activeOperations.delete(normalizedOperationId);
        return true;
    }

    private async executeArgs(args: string[], cwd: string, options?: GitExecutionOptions): Promise<GitExecutionResult> {
        const timeoutMs = this.normalizeTimeoutMs(options?.timeoutMs);
        const operationId = options?.operationId?.trim();
        const controller = new AbortController();

        if (operationId) {
            if (this.activeOperations.has(operationId)) {
                return { success: false, error: `Operation already running: ${operationId}` };
            }
            this.activeOperations.set(operationId, controller);
        }

        try {
            const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
                execFile(
                    'git',
                    args,
                    {
                        cwd,
                        shell: false,
                        maxBuffer: 10 * 1024 * 1024,
                        timeout: timeoutMs,
                        signal: controller.signal,
                    },
                    (error, out, err) => {
                        if (error) {
                            reject(error);
                            return;
                        }
                        resolve({ stdout: out, stderr: err });
                    }
                );
            });
            return { success: true, stdout, stderr };
        } catch (error) {
            const baseError = getErrorMessage(error);
            if (controller.signal.aborted) {
                return {
                    success: false,
                    error: `Git operation cancelled${operationId ? `: ${operationId}` : ''}`,
                    cancelled: true,
                };
            }
            const isTimedOut = baseError.includes('timed out');
            const decorated = this.decorateGitError(baseError, cwd);
            return { success: false, ...decorated, timedOut: isTimedOut };
        } finally {
            if (operationId) {
                this.activeOperations.delete(operationId);
            }
        }
    }

    private async execute(command: string, cwd: string, options?: GitExecutionOptions) {
        const args = this.tokenizeCommand(command);
        return await this.executeArgs(args, cwd, options);
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

    async executeRaw(cwd: string, command: string, options?: GitExecutionOptions) {
        return await this.execute(command, cwd, options);
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
