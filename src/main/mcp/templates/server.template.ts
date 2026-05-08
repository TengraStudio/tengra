/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

/**
 * Template for creating a new MCP server module.
 * Copy this file and replace placeholders.
 */
export function buildTemplateServer(_deps: McpDeps): McpService {
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
        ], 'template-server')
    };
}


