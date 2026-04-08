import { buildActions, ensureAllowedTarget, McpDeps, validateCommand, validateHostname, validateString, withTimeout } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';
import { SSHConnection } from '@main/services/workspace/ssh.service';

/**
 * Validates SSH connection ID format
 */
const validateConnectionId = (id: RuntimeValue): string => {
    const connId = validateString(id, 100);

    if (!connId) {
        throw new Error('Connection ID is required');
    }

    // Only allow alphanumeric and hyphens
    if (!/^[a-zA-Z0-9-]+$/.test(connId)) {
        throw new Error('Invalid connection ID format');
    }

    return connId;
};

/**
 * Validates SSH connection parameters
 */
const validateSSHConnection = (args: RuntimeValue): SSHConnection => {
    const conn = args as SSHConnection;

    if (!conn || typeof conn !== 'object') {
        throw new Error('Invalid SSH connection parameters');
    }

    // Validate required fields
    if (!conn.host || typeof conn.host !== 'string') {
        throw new Error('SSH host is required');
    }

    if (!conn.username || typeof conn.username !== 'string') {
        throw new Error('SSH username is required');
    }

    // Validate host format
    validateHostname(conn.host);

    // Validate port if provided
    if (conn.port !== undefined) {
        const port = Number(conn.port);
        if (isNaN(port) || port < 1 || port > 65535) {
            throw new Error('Invalid SSH port (must be 1-65535)');
        }
    }

    // Note: Password/key should be encrypted by the service layer using Electron safeStorage
    // We don't validate them here to avoid logging sensitive data

    return conn;
};

export function buildNetworkServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'ssh', 
            actions: buildActions([
                {
                    name: 'connect', 
                    handler: (args) => withTimeout(
                        () => deps.ssh.connect(validateSSHConnection(args)),
                        30000
                    )
                },
                {
                    name: 'execute', 
                    handler: ({ connectionId, command, cwd }) => {
                        const validConnId = validateConnectionId(connectionId);
                        const validCommand = validateCommand(command);
                        const validCwd = cwd ? validateString(cwd, 500) : undefined;

                        return withTimeout(
                            () => deps.ssh.executeCommand(
                                validConnId,
                                validCommand,
                                validCwd ? { cwd: validCwd } : undefined
                            ),
                            60000 // 1 minute timeout for remote commands
                        );
                    }
                },
                {
                    name: 'disconnect', 
                    handler: ({ connectionId }) => withTimeout(
                        async () => {
                            await deps.ssh.disconnect(validateConnectionId(connectionId));
                            return { success: true };
                        },
                        10000
                    )
                }
            ], 'ssh', deps.auditLog)
        },
        {
            name: 'network', 
            actions: buildActions([
                {
                    name: 'ping', 
                    handler: ({ host }) => {
                        const allowedHost = ensureAllowedTarget(deps, host as string);

                        return withTimeout(
                            () => deps.network.ping(allowedHost),
                            30000
                        );
                    }
                },
                {
                    name: 'traceroute', 
                    handler: ({ host }) => {
                        const allowedHost = ensureAllowedTarget(deps, host as string);

                        return withTimeout(
                            () => deps.network.traceroute(allowedHost),
                            60000 // Traceroute can take longer
                        );
                    }
                },
                {
                    name: 'whois', 
                    handler: ({ domain }) => {
                        const allowedDomain = ensureAllowedTarget(deps, domain as string);

                        return withTimeout(
                            () => deps.network.whois(allowedDomain),
                            30000
                        );
                    }
                }
            ], 'network', deps.auditLog)
        }
    ];
}
