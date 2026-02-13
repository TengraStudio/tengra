import { buildActions, McpDeps, validateString } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

function buildGitHubRepo(owner: string, repo: string): string {
    return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

export function buildCicdServer(deps: McpDeps): McpService {
    return {
        name: 'cicd',
        description: 'CI/CD insights for pipelines, runs, and release health',
        actions: buildActions([
            {
                name: 'githubWorkflowRuns',
                description: 'List latest GitHub Actions workflow runs for a repository',
                handler: async ({ owner, repo }) => {
                    const safeOwner = validateString(owner, 120);
                    const safeRepo = validateString(repo, 120);
                    return deps.web.fetchJson(`${buildGitHubRepo(safeOwner, safeRepo)}/actions/runs?per_page=10`);
                }
            },
            {
                name: 'githubReleases',
                description: 'List latest GitHub releases for a repository',
                handler: async ({ owner, repo }) => {
                    const safeOwner = validateString(owner, 120);
                    const safeRepo = validateString(repo, 120);
                    return deps.web.fetchJson(`${buildGitHubRepo(safeOwner, safeRepo)}/releases?per_page=10`);
                }
            },
            {
                name: 'dockerStatus',
                description: 'Get Docker daemon status and active resources',
                handler: async () => {
                    const containers = await deps.docker.listContainers();
                    const stats = await deps.docker.getStats();
                    return {
                        success: true,
                        data: { containers, stats }
                    };
                }
            }
        ], 'cicd', deps.auditLog)
    };
}
