import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

import { getErrorMessage } from '@shared/utils/error.util';

const execAsync = promisify(exec);

export class GitService {
    private async execute(command: string, cwd: string) {
        try {
            const { stdout, stderr } = await execAsync(`git ${command} `, { cwd });
            return { success: true, stdout, stderr };
        } catch (error) {
            return { success: false, error: getErrorMessage(error) };
        }
    }

    async getStatus(cwd: string): Promise<{ path: string, status: string }[]> {
        const { stdout } = await this.execute('status --short', cwd);
        if (!stdout) { return [] }

        return stdout.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const status = line.substring(0, 2)
                const path = line.substring(3)
                return { path, status }
            })
    }

    async add(cwd: string, files: string = '.') {
        return await this.execute(`add "${files}"`, cwd);
    }

    async commit(cwd: string, message: string) {
        return await this.execute(`commit - m "${message}"`, cwd);
    }

    async push(cwd: string, remote: string = 'origin', branch: string = 'main') {
        return await this.execute(`push ${remote} ${branch} `, cwd);
    }

    async pull(cwd: string) {
        return await this.execute('pull', cwd);
    }

    async getLog(cwd: string, count: number = 10) {
        const { stdout } = await this.execute(`log - n ${count} --pretty=format: "%h|%s|%an|%cI"`, cwd);
        if (!stdout) { return [] }

        return stdout.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [hash, message, author, date] = line.split('|')
                return { hash, message, author, date }
            })
    }

    async getBranches(cwd: string) {
        return await this.execute('branch', cwd);
    }

    async checkout(cwd: string, branch: string) {
        return await this.execute(`checkout ${branch} `, cwd);
    }

    async executeRaw(cwd: string, command: string) {
        return await this.execute(command, cwd);
    }

    async getFileDiff(cwd: string, filePath: string, staged: boolean = false): Promise<{ original: string; modified: string; success: boolean; error?: string }> {
        try {
            const command = staged ? `diff --cached -- "${filePath}"` : `diff -- "${filePath}"`
            const result = await this.execute(command, cwd)

            if (!result.success || !result.stdout) {
                return await this.getFallbackDiff(cwd, filePath, staged)
            }

            return this.parseUnifiedDiff(result.stdout)
        } catch (error) {
            return { original: '', modified: '', success: false, error: getErrorMessage(error) }
        }
    }

    private async getFallbackDiff(cwd: string, filePath: string, staged: boolean): Promise<{ original: string; modified: string; success: boolean }> {
        if (staged) {
            const contentResult = await this.execute(`show : "${filePath}"`, cwd)
            if (contentResult.success && contentResult.stdout) {
                return { original: '', modified: contentResult.stdout, success: true }
            }
        }

        const fullPath = join(cwd, filePath)
        try {
            const currentContent = await fs.readFile(fullPath, 'utf8')
            const headResult = await this.execute(`show HEAD: "${filePath}"`, cwd)

            return {
                original: (headResult.success && headResult.stdout) ? headResult.stdout : '',
                modified: currentContent,
                success: true
            }
        } catch {
            return { original: '', modified: '', success: false }
        }
    }

    private parseUnifiedDiff(stdout: string): { original: string; modified: string; success: boolean } {
        const lines = stdout.split('\n')
        let original = ''
        let modified = ''
        let inOriginal = false
        let inModified = false

        for (const line of lines) {
            if (line.startsWith('---') || line.startsWith('+++')) { continue }
            if (line.startsWith('@@')) {
                inOriginal = true
                inModified = true
                continue
            }

            if (inOriginal && inModified) {
                if (line.startsWith('-') && !line.startsWith('--')) {
                    original += line.substring(1) + '\n'
                } else if (line.startsWith('+') && !line.startsWith('++')) {
                    modified += line.substring(1) + '\n'
                } else if (line.startsWith(' ')) {
                    const context = line.substring(1)
                    original += context + '\n'
                    modified += context + '\n'
                }
            }
        }

        return { original: original.trim(), modified: modified.trim(), success: true }
    }

    async getUnifiedDiff(cwd: string, filePath: string, staged: boolean = false): Promise<{ diff: string; success: boolean; error?: string }> {
        try {
            const command = staged ? `diff --cached -- "${filePath}"` : `diff -- "${filePath}"`

            const { stdout, stderr, success } = await this.execute(command, cwd)

            if (!success && stderr && !stdout) {
                // File might be newly added - return empty diff for now
                return { diff: '', success: true }
            }

            return { diff: stdout ?? '', success: true }
        } catch (error) {
            return { diff: '', success: false, error: getErrorMessage(error) };
        }
    }

    async stageFile(cwd: string, filePath: string) {
        return await this.execute(`add "${filePath}"`, cwd);
    }

    async unstageFile(cwd: string, filePath: string) {
        return await this.execute(`reset HEAD-- "${filePath}"`, cwd);
    }
}
