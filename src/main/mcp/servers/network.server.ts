import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';
import { SSHConnection } from '@main/services/project/ssh.service';

export function buildNetworkServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'web',
            description: 'HTTP utilities',
            actions: buildActions([
                { name: 'fetch', description: 'Fetch web page HTML/text', handler: ({ url }) => deps.web.fetchWebPage(url as string) },
                { name: 'search', description: 'Search the web', handler: ({ query, numResults }) => deps.web.searchWeb(query as string, numResults as number) }
            ])
        },
        {
            name: 'ssh',
            description: 'SSH connections and remote commands',
            actions: buildActions([
                { name: 'connect', description: 'Open SSH connection', handler: (args) => deps.ssh.connect(args as unknown as SSHConnection) },
                { name: 'execute', description: 'Run remote command', handler: ({ connectionId, command, cwd }) => deps.ssh.executeCommand(connectionId as string, command as string, { cwd: cwd as string }) },
                { name: 'disconnect', description: 'Close SSH connection', handler: ({ connectionId }) => deps.ssh.disconnect(connectionId as string).then(() => ({ success: true })) }
            ])
        },
        {
            name: 'network',
            description: 'Network utilities',
            actions: buildActions([
                { name: 'ping', description: 'Ping host', handler: ({ host }) => deps.network.ping(host as string) },
                { name: 'traceroute', description: 'Run traceroute', handler: ({ host }) => deps.network.traceroute(host as string) },
                { name: 'whois', description: 'WHOIS lookup', handler: ({ domain }) => deps.network.whois(domain as string) }
            ])
        }
    ];
}
