import { McpService } from '@main/mcp/types';

import { buildCoreServers } from './servers/core.server';
import { buildDataServers } from './servers/data.server';
import { buildDevServers } from './servers/dev.server';
import { buildGitServer } from './servers/git.server';
import { buildInternetServers } from './servers/internet.server';
import { buildNetworkServers } from './servers/network.server';
import { buildProjectServers } from './servers/project.server';
import { buildSecurityServers } from './servers/security.server';
import { buildUtilityServers } from './servers/utility.server';
import { buildWebServer } from './servers/web.server';
import { McpDeps } from './server-utils';

export function buildMcpServices(deps: McpDeps): McpService[] {
    return [
        ...buildCoreServers(deps),
        ...buildNetworkServers(deps),
        ...buildUtilityServers(deps),
        ...buildProjectServers(deps),
        ...buildDataServers(deps),
        ...buildSecurityServers(deps),
        buildGitServer(deps),
        buildWebServer(deps),
        ...buildInternetServers(deps),
        ...buildDevServers(deps)
    ];
}

