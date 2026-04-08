import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

export function buildWorkspaceServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'docker',
            actions: buildActions([
                { name: 'listContainers', handler: () => deps.docker.listContainers() },
                { name: 'stats', handler: () => deps.docker.getStats() },
                { name: 'listImages', handler: () => deps.docker.listImages() }
            ], 'docker', deps.auditLog)
        }
    ];
}

/** @deprecated Use buildWorkspaceServers instead */
