import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

export function buildCoreServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'filesystem',
            description: 'File system access with allowed-root guardrails',
            actions: buildActions([
                { name: 'read', description: 'Read a UTF-8 file', handler: ({ path }) => deps.filesystem.readFile(path as string) },
                { name: 'write', description: 'Write text to file', handler: ({ path, content }) => deps.filesystem.writeFile(path as string, content as string) },
                { name: 'list', description: 'List directory entries', handler: ({ path }) => deps.filesystem.listDirectory(path as string) }
            ], 'filesystem', deps.auditLog)
        },
        {
            name: 'file',
            description: 'File management helpers (zip, download, rename)',
            actions: buildActions([
                { name: 'extractStrings', description: 'Extract printable strings', handler: ({ path, minLength }) => deps.file.extractStrings(path as string, minLength as number) },
                { name: 'unzip', description: 'Unzip archive', handler: ({ zipPath, destPath }) => deps.file.unzip(zipPath as string, destPath as string) },
                { name: 'download', description: 'Download a file over HTTPS', handler: ({ url, destPath }) => deps.file.downloadFile(url as string, destPath as string) }
            ], 'file', deps.auditLog)
        },
        {
            name: 'command',
            description: 'Local shell execution with safety checks',
            actions: buildActions([
                { name: 'run', description: 'Execute a shell command', handler: ({ command, cwd }) => deps.command.executeCommand(command as string, { cwd: cwd as string }) },
                { name: 'kill', description: 'Kill a tracked command', handler: ({ id }) => Promise.resolve({ success: deps.command.killCommand(id as string) }) }
            ], 'command', deps.auditLog)
        },
        {
            name: 'system',
            description: 'Local system info',
            actions: buildActions([
                { name: 'diskSpace', description: 'Get disk space info', handler: () => deps.system.getDiskSpace() },
                { name: 'processOnPort', description: 'Find process on port', handler: ({ port }) => deps.system.getProcessOnPort(Number(port)) }
            ], 'system', deps.auditLog)
        }
    ];
}
