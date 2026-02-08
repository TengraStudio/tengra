import { buildActions, McpDeps, validatePath, validateString } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';
import * as os from 'os';

export function buildProjectServers(deps: McpDeps): McpService[] {
    // Path validation helper
    const validateScanPath = (inputPath: string): string => {
        const validatedInput = validateString(inputPath, 2000);
        const settings = deps.settings.getSettings();
        const allowedRoots = settings.allowedFileRoots;

        // Get allowed roots or use home directory
        const roots = Array.isArray(allowedRoots) && allowedRoots.length > 0
            ? allowedRoots.filter((r): r is string => typeof r === 'string')
            : [os.homedir()];

        // Try to validate against each allowed root
        for (const root of roots) {
            try {
                return validatePath(root, validatedInput);
            } catch {
                // Continue to next root
            }
        }

        throw new Error(`Scan path not allowed. Must be within one of: ${roots.join(', ')}`);
    };

    return [
        {
            name: 'scanner',
            description: 'Project scanning (path traversal protected)',
            actions: buildActions([
                {
                    name: 'scanDirectory',
                    description: 'Scan directory for code files (path traversal protected)',
                    handler: ({ path }) => deps.scanner.scanDirectory(validateScanPath(path as string))
                }
            ], 'scanner', deps.auditLog)
        },
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
