import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

export function buildProjectServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'scanner',
            description: 'Project scanning',
            actions: buildActions([
                { name: 'scanDirectory', description: 'Scan directory for code files', handler: ({ path }) => deps.scanner.scanDirectory(path as string) }
            ])
        },
        {
            name: 'docker',
            description: 'Docker utilities',
            actions: buildActions([
                { name: 'listContainers', description: 'List docker containers', handler: () => deps.docker.listContainers() },
                { name: 'stats', description: 'Docker stats (no stream)', handler: () => deps.docker.getStats() },
                { name: 'listImages', description: 'List docker images', handler: () => deps.docker.listImages() }
            ])
        }
    ];
}
