import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitService {
    private async execute(command: string, cwd: string) {
        try {
            const { stdout, stderr } = await execAsync(`git ${command}`, { cwd });
            return { success: true, stdout, stderr };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async getStatus(cwd: string): Promise<{ path: string, status: string }[]> {
        const { stdout } = await this.execute('status --short', cwd);
        if (!stdout) return []

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
        return await this.execute(`commit -m "${message}"`, cwd);
    }

    async push(cwd: string, remote: string = 'origin', branch: string = 'main') {
        return await this.execute(`push ${remote} ${branch}`, cwd);
    }

    async pull(cwd: string) {
        return await this.execute('pull', cwd);
    }

    async getLog(cwd: string, count: number = 10) {
        const { stdout } = await this.execute(`log -n ${count} --pretty=format:"%h|%s|%an|%cI"`, cwd);
        if (!stdout) return []

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
        return await this.execute(`checkout ${branch}`, cwd);
    }

    async executeRaw(cwd: string, command: string) {
        return await this.execute(command, cwd);
    }
}
