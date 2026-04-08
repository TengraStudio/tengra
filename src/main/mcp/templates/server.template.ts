import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

/**
 * Template for creating a new MCP server module.
 * Copy this file and replace placeholders.
 */
export function buildTemplateServer(deps: McpDeps): McpService {
    return {
        name: 'template-server',
        actions: buildActions([
            {
                name: 'exampleAction',
                handler: async ({ input }) => {
                    return {
                        success: true,
                        data: {
                            received: input ?? null
                        }
                    };
                }
            }
        ], 'template-server', deps.auditLog)
    };
}

