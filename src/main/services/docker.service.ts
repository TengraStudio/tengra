import { CommandService } from './command.service';
import { SSHService } from './ssh.service';

export class DockerService {
    constructor(
        private command: CommandService,
        private ssh: SSHService
    ) { }

    private async execute(cmd: string, connectionId?: string): Promise<any> {
        if (connectionId) {
            const result = await this.ssh.executeCommand(connectionId, cmd);
            return result;
        } else {
            const result = await this.command.executeCommand(cmd);
            return result;
        }
    }

    async listContainers(all: boolean = false, connectionId?: string) {
        const cmd = `docker ps ${all ? '-a' : ''} --format "{{json .}}"`;
        const result = await this.execute(cmd, connectionId);

        if (!result.success) return result;

        try {
            // Docker outputs multiple JSON objects, one per line
            const lines = result.stdout.trim().split('\n').filter((l: string) => l.length > 0);
            const containers = lines.map((l: string) => JSON.parse(l));
            return { success: true, containers };
        } catch (e: any) {
            return { success: false, error: 'Failed to parse docker output: ' + e.message, raw: result.stdout };
        }
    }

    async manageContainer(id: string, action: 'start' | 'stop' | 'restart' | 'remove', connectionId?: string) {
        const cmd = `docker ${action === 'remove' ? 'rm -f' : action} ${id}`;
        return await this.execute(cmd, connectionId);
    }

    async getLogs(id: string, tail: number = 50, connectionId?: string) {
        const cmd = `docker logs --tail ${tail} ${id}`;
        return await this.execute(cmd, connectionId);
    }

    async getStats(connectionId?: string) {
        const cmd = `docker stats --no-stream --format "{{json .}}"`;
        const result = await this.execute(cmd, connectionId);

        if (!result.success) return result;

        try {
            const lines = result.stdout.trim().split('\n').filter((l: string) => l.length > 0);
            const stats = lines.map((l: string) => JSON.parse(l));
            return { success: true, stats };
        } catch (e: any) {
            return { success: false, error: 'Failed to parse docker stats: ' + e.message, raw: result.stdout };
        }
    }

    async listImages(connectionId?: string) {
        const cmd = `docker images --format "{{json .}}"`;
        const result = await this.execute(cmd, connectionId);

        if (!result.success) return result;

        try {
            const lines = result.stdout.trim().split('\n').filter((l: string) => l.length > 0);
            const images = lines.map((l: string) => JSON.parse(l));
            return { success: true, images };
        } catch (e: any) {
            return { success: false, error: 'Failed to parse docker images: ' + e.message, raw: result.stdout };
        }
    }
}
