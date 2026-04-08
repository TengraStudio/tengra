import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

const WEB_MESSAGE_KEY = {
    INVALID_QUERY: 'mainProcess.webServer.invalidQuery',
    QUERY_TOO_LONG: 'mainProcess.webServer.queryTooLong',
    INVALID_URL_REQUIRED: 'mainProcess.webServer.invalidUrlRequired',
    INVALID_URL_PROTOCOL: 'mainProcess.webServer.invalidUrlProtocol',
    INVALID_URL_FORMAT: 'mainProcess.webServer.invalidUrlFormat'
} as const;
const WEB_ERROR_MESSAGE = {
    INVALID_QUERY: 'Invalid query: must be non-empty string',
    QUERY_TOO_LONG: 'Query too long (max 500 characters)',
    INVALID_URL_REQUIRED: 'Invalid URL: must be non-empty string',
    INVALID_URL_PROTOCOL: 'Invalid URL: only HTTP/HTTPS protocols allowed',
    INVALID_URL_FORMAT: 'Invalid URL format'
} as const;

export function buildWebServer(deps: McpDeps): McpService {
    return {
        name: 'web', 
        actions: buildActions([
            {
                name: 'search', 
                handler: ({ query, count }) => {
                    // SEC-008-4: Validate parameters
                    if (typeof query !== 'string' || query.length === 0) {
                        return {
                            success: false,
                            error: WEB_ERROR_MESSAGE.INVALID_QUERY,
                            messageKey: WEB_MESSAGE_KEY.INVALID_QUERY
                        };
                    }
                    if (typeof query === 'string' && query.length > 500) {
                        return {
                            success: false,
                            error: WEB_ERROR_MESSAGE.QUERY_TOO_LONG,
                            messageKey: WEB_MESSAGE_KEY.QUERY_TOO_LONG
                        };
                    }
                    const validCount = typeof count === 'number' && count > 0 && count <= 20 ? count : 5;
                    return deps.web.searchWeb(query, validCount);
                }
            },
            {
                name: 'read_page', 
                handler: ({ url }) => {
                    // SEC-008-4: Validate URL
                    if (typeof url !== 'string' || url.length === 0) {
                        return {
                            success: false,
                            error: WEB_ERROR_MESSAGE.INVALID_URL_REQUIRED,
                            messageKey: WEB_MESSAGE_KEY.INVALID_URL_REQUIRED
                        };
                    }
                    try {
                        const parsed = new URL(url);
                        if (!['http:', 'https:'].includes(parsed.protocol)) {
                            return {
                                success: false,
                                error: WEB_ERROR_MESSAGE.INVALID_URL_PROTOCOL,
                                messageKey: WEB_MESSAGE_KEY.INVALID_URL_PROTOCOL
                            };
                        }
                    } catch {
                        return {
                            success: false,
                            error: WEB_ERROR_MESSAGE.INVALID_URL_FORMAT,
                            messageKey: WEB_MESSAGE_KEY.INVALID_URL_FORMAT
                        };
                    }
                    return deps.web.fetchWebPage(url);
                }
            },
            {
                name: 'fetch_json', 
                handler: ({ url }) => {
                    // SEC-008-4: Validate URL
                    if (typeof url !== 'string' || url.length === 0) {
                        return {
                            success: false,
                            error: WEB_ERROR_MESSAGE.INVALID_URL_REQUIRED,
                            messageKey: WEB_MESSAGE_KEY.INVALID_URL_REQUIRED
                        };
                    }
                    try {
                        const parsed = new URL(url);
                        if (!['http:', 'https:'].includes(parsed.protocol)) {
                            return {
                                success: false,
                                error: WEB_ERROR_MESSAGE.INVALID_URL_PROTOCOL,
                                messageKey: WEB_MESSAGE_KEY.INVALID_URL_PROTOCOL
                            };
                        }
                    } catch {
                        return {
                            success: false,
                            error: WEB_ERROR_MESSAGE.INVALID_URL_FORMAT,
                            messageKey: WEB_MESSAGE_KEY.INVALID_URL_FORMAT
                        };
                    }
                    return deps.web.fetchJson(url);
                }
            }
        ], 'web', deps.auditLog)
    };
}
