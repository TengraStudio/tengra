import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

export function buildGitServer(deps: McpDeps): McpService {
    return {
        name: 'git',
        description: 'Git version control operations',
        actions: buildActions([
            {
                name: 'status',
                description: 'Get git status',
                handler: ({ cwd }) => deps.git.getStatus(cwd as string)
            },
            {
                name: 'diff',
                description: 'Get file diff',
                handler: ({ cwd, file, staged }) => deps.git.getUnifiedDiff(cwd as string, file as string, staged as boolean)
            },
            {
                name: 'log',
                description: 'Get commit log',
                handler: ({ cwd, count }) => deps.git.getLog(cwd as string, (count as number) || 10)
            },
            {
                name: 'commit',
                description: 'Commit changes',
                handler: ({ cwd, message }) => deps.git.commit(cwd as string, message as string)
            },
            {
                name: 'add',
                description: 'Add files to stage',
                handler: ({ cwd, files }) => deps.git.add(cwd as string, (files as string) || '.')
            },
            {
                name: 'push',
                description: 'Push changes',
                handler: ({ cwd, remote, branch }) => deps.git.push(cwd as string, (remote as string) || 'origin', (branch as string) || 'main')
            },
            {
                name: 'pull',
                description: 'Pull changes',
                handler: ({ cwd }) => deps.git.pull(cwd as string)
            },
            {
                name: 'checkout',
                description: 'Checkout branch',
                handler: ({ cwd, branch }) => deps.git.checkout(cwd as string, branch as string)
            },
            {
                name: 'branches',
                description: 'List branches',
                handler: ({ cwd }) => deps.git.getBranches(cwd as string)
            }
        ])
    };
}
