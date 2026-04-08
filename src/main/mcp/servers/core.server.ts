import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

export function buildCoreServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'filesystem', 
            actions: buildActions([
                { name: 'read', handler: ({ path }) => deps.filesystem.readFile(path as string) },
                { name: 'write', handler: ({ path, content }) => deps.filesystem.writeFile(path as string, content as string) },
                { name: 'list', handler: ({ path }) => deps.filesystem.listDirectory(path as string) },
                { name: 'extractStrings', handler: ({ path, minLength }) => deps.file.extractStrings(path as string, minLength as number) },
                { name: 'unzip', handler: ({ zipPath, destPath }) => deps.file.unzip(zipPath as string, destPath as string) },
                { name: 'download', handler: ({ url, destPath }) => deps.file.downloadFile(url as string, destPath as string) }
            ], 'filesystem', deps.auditLog)
        },
        {
            name: 'command', 
            actions: buildActions([
                { name: 'run', handler: ({ command, cwd }) => deps.command.executeCommand(command as string, { cwd: cwd as string }) },
                { name: 'kill', handler: ({ id }) => Promise.resolve({ success: deps.command.killCommand(id as string) }) }
            ], 'command', deps.auditLog)
        },
        {
            name: 'system', 
            actions: buildActions([
                { name: 'diskSpace', handler: () => deps.system.getDiskSpace() },
                { name: 'processOnPort', handler: ({ port }) => deps.system.getProcessOnPort(Number(port)) },
                { name: 'usage', handler: () => deps.system.getUsage() }
            ], 'system', deps.auditLog)
        }
    ];
}
