import { buildActions, McpDeps, validateString, validateUrl } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

export function buildCloudStorageServer(deps: McpDeps): McpService {
    return {
        name: 'cloud-storage',
        description: 'Cloud storage discovery and metadata helpers',
        actions: buildActions([
            {
                name: 'supportedProviders',
                description: 'List supported cloud providers and expected auth env keys',
                handler: async () => ({
                    success: true,
                    data: [
                        { id: 's3', authEnv: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'] },
                        { id: 'gcs', authEnv: ['GOOGLE_APPLICATION_CREDENTIALS'] },
                        { id: 'azure-blob', authEnv: ['AZURE_STORAGE_CONNECTION_STRING'] },
                        { id: 'r2', authEnv: ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] }
                    ]
                })
            },
            {
                name: 'inspectPublicObject',
                description: 'Fetch public object metadata from a cloud URL',
                handler: async ({ url }) => {
                    const safeUrl = validateUrl(url, ['https:']);
                    return deps.web.fetchJson(`https://r.jina.ai/http://${new URL(safeUrl).host}${new URL(safeUrl).pathname}`);
                }
            },
            {
                name: 'buildObjectPath',
                description: 'Build canonical provider/object path string',
                handler: async ({ provider, bucket, objectKey }) => {
                    const safeProvider = validateString(provider, 64).toLowerCase();
                    const safeBucket = validateString(bucket, 200);
                    const safeObjectKey = validateString(objectKey, 2000);
                    return {
                        success: true,
                        data: `${safeProvider}://${safeBucket}/${safeObjectKey.replace(/^\/+/, '')}`
                    };
                }
            }
        ], 'cloud-storage', deps.auditLog)
    };
}

