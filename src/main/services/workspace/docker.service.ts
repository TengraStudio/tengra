import { SSHService } from '@main/services/project/ssh.service';
import { CommandService } from '@main/services/system/command.service';
import { JsonObject } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';

export class DockerService {
    constructor(
        private command: CommandService,
        private ssh: SSHService
    ) { }

    private async execute(cmd: string, connectionId?: string): Promise<{ success: boolean; stdout: string; stderr: string }> {
        if (connectionId) {
            const sshResult = await this.ssh.executeCommand(connectionId, cmd);
            return {
                success: sshResult.code === 0,
                stdout: sshResult.stdout,
                stderr: sshResult.stderr
            };
        } else {
            const result = await this.command.executeCommand(cmd);
            return {
                success: result.success,
                stdout: result.stdout ?? '',
                stderr: result.stderr ?? ''
            };
        }
    }

    async listContainers(all: boolean = false, connectionId?: string) {
        const cmd = `docker ps ${all ? '-a' : ''} --format "{{json .}}"`;
        const result = await this.execute(cmd, connectionId);

        if (!result.success) { return result; }

        try {
            // Docker outputs multiple JSON objects, one per line
            const lines = result.stdout.trim().split('\n').filter((l: string) => l.length > 0);
            const containers = lines.map((l: string) => safeJsonParse<JsonObject>(l, {}));
            return { success: true, containers };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return { success: false, error: 'Failed to parse docker output: ' + message, raw: result.stdout };
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

        if (!result.success) { return result; }

        try {
            const lines = result.stdout.trim().split('\n').filter((l: string) => l.length > 0);
            const stats = lines.map((l: string) => safeJsonParse<JsonObject>(l, {}));
            return { success: true, stats };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return { success: false, error: 'Failed to parse docker stats: ' + message, raw: result.stdout };
        }
    }

    async listImages(connectionId?: string) {
        const cmd = `docker images --format "{{json .}}"`;
        const result = await this.execute(cmd, connectionId);

        if (!result.success) { return result; }

        try {
            const lines = result.stdout.trim().split('\n').filter((l: string) => l.length > 0);
            const images = lines.map((l: string) => safeJsonParse<JsonObject>(l, {}));
            return { success: true, images };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return { success: false, error: 'Failed to parse docker images: ' + message, raw: result.stdout };
        }
    }
}
