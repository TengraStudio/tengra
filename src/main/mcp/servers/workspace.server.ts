import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

export function buildWorkspaceServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'docker',
            description: 'Docker utilities',
            actions: buildActions([
                { name: 'listContainers', description: 'List docker containers', handler: () => deps.docker.listContainers() },
                { name: 'stats', description: 'Docker stats (no stream)', handler: () => deps.docker.getStats() },
                { name: 'listImages', description: 'List docker images', handler: () => deps.docker.listImages() }
            ], 'docker', deps.auditLog)
        }
    ];
}

/** @deprecated Use buildWorkspaceServers instead */