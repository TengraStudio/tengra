import { McpService } from '@main/mcp/types';

import { buildCoreServers } from './servers/core.server';
import { buildDataServers } from './servers/data.server';
import { buildNetworkServers } from './servers/network.server';
import { buildProjectServers } from './servers/project.server';
import { buildSecurityServers } from './servers/security.server';
import { buildUtilityServers } from './servers/utility.server';
import { McpDeps } from './server-utils';

export function buildMcpServices(deps: McpDeps): McpService[] {
    return [
        ...buildCoreServers(deps),
        ...buildNetworkServers(deps),
        ...buildUtilityServers(deps),
        ...buildProjectServers(deps),
        ...buildDataServers(deps),
        ...buildSecurityServers(deps)
    ];
}

