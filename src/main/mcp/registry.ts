import { McpService } from '@main/mcp/types';

import { buildCoreServers } from './servers/core.server';
import { buildDataServers } from './servers/data.server';
import { buildGitServer } from './servers/git.server';
import { buildInternetServers } from './servers/internet.server';
import { buildNetworkServers } from './servers/network.server';
import { buildWebServer } from './servers/web.server';
import { buildWorkspaceServers } from './servers/workspace.server';
import { McpDeps } from './server-utils';

export function buildMcpServices(deps: McpDeps): McpService[] {
    return [
        ...buildCoreServers(deps),
        ...buildNetworkServers(deps),
        ...buildWorkspaceServers(deps),
        ...buildDataServers(deps),
        buildGitServer(deps),
        buildWebServer(deps),
        ...buildInternetServers(deps)
    ];
}

