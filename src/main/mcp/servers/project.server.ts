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
            name: 'git',
            description: 'Git helpers',
            actions: buildActions([
                { name: 'status', description: 'Get git status', handler: ({ repoPath }) => deps.git.getStatus(repoPath as string) },
                { name: 'log', description: 'Get git log', handler: ({ repoPath, limit }) => deps.git.getLog(repoPath as string, limit as number) }
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
