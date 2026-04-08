import { McpService } from '@main/mcp/types';

import { buildCoreServers } from './servers/core.server';
import { buildDataServers } from './servers/data.server';
import { McpDeps } from './server-utils';

export function buildMcpServices(deps: McpDeps): McpService[] {
    return [
        ...buildCoreServers(deps),
        ...buildDataServers(deps),
    ].map(service => ({
        ...service,
        description: service.description ?? service.name,
        actions: service.actions.map(action => ({
            ...action,
            description: action.description ?? action.name,
        })),
    }));
}

