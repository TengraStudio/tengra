import { BaseService } from '@main/services/base.service';
import { MultiLevelCache } from '@main/utils/cache.util';
import { JsonValue } from '@shared/types/common';
import axios, { AxiosRequestConfig } from 'axios';

/**
 * MCP Marketplace Server from Registry API
 */
export interface McpMarketplaceServer {
    id: string
    name: string
    description: string
    publisher: string
    version?: string
    categories?: string[]
    tags?: string[]
    repository?: string
    npmPackage?: string
    command?: string
    license?: string
    downloads?: number
    rating?: number
    isOfficial?: boolean
    extensionType?: 'mcp_server' | 'theme' | 'command' | 'language' | 'agent_template' | 'widget' | 'integration'
    capabilities?: string[]
    dependencies?: string[]
    conflictsWith?: string[]
    settingsSchema?: Record<string, JsonValue>
    settingsVersion?: number
    updatePolicy?: {
        channel?: 'stable' | 'beta' | 'alpha'
        autoUpdate?: boolean
        scheduleCron?: string
        signatureSha256?: string
    }
    storage?: {
        quotaMb?: number
    }
    oauth?: {
        enabled?: boolean
        authUrl?: string
        tokenUrl?: string
        scopes?: string[]
    }
}

export interface McpExtensionTemplate {
    id: string;
    type: 'mcp_server' | 'theme' | 'command' | 'language' | 'agent_template' | 'widget' | 'integration';
    name: string;
    description: string;
    manifest: {
        entrypoint: string;
        permissions: string[];
        capabilities: string[];
    };
}

interface MarketplaceFetchTelemetry {
    totalRequests: number;
    totalRetries: number;
    transientFailures: number;
    fallbackUsages: number;
    lastFailureAt?: number;
}

interface MarketplacePackageManifest {
    name?: string;
    description?: string;
    author?: string | { name?: string };
    version?: string;
    repository?: { url?: string };
    license?: string;
}

interface TengraMarketplaceResponseItem {
    id?: string;
    name?: string;
    description?: string;
    publisher?: string;
    version?: string;
    categories?: string[];
    tags?: string[];
    repository?: string;
    npmPackage?: string;
    command?: string;
    license?: string;
    downloads?: number;
    rating?: number;
    isOfficial?: boolean;
    extensionType?: McpMarketplaceServer['extensionType'];
    capabilities?: string[];
    dependencies?: string[];
    conflictsWith?: string[];
}

function resolveAuthorName(author: MarketplacePackageManifest['author']): string | undefined {
    if (!author) {
        return undefined;
    }
    if (typeof author === 'string') {
        return author;
    }
    return author.name;
}

/**
 * McpMarketplaceService fetches and caches MCP servers from the official
 * GitHub repository (modelcontextprotocol/servers).
 */
export class McpMarketplaceService extends BaseService {
    private readonly cache = new MultiLevelCache<McpMarketplaceServer[]>({
        name: 'mcp-marketplace',
        hot: { maxSize: 4, defaultTTL: 15 * 60 * 1000 },
        warm: { maxSize: 8, defaultTTL: 60 * 60 * 1000 }
    });
    private readonly CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
    private readonly CACHE_KEY_ALL = 'servers:all';
    private readonly TENGRA_MARKETPLACE_API = 'https://api.tengra.studio/marketplace';
    private hasLoadedRemoteCatalog = false;
    private readonly fetchTelemetry: MarketplaceFetchTelemetry = {
        totalRequests: 0,
        totalRetries: 0,
        transientFailures: 0,
        fallbackUsages: 0
    };
    private readonly EXTENSION_TEMPLATES: McpExtensionTemplate[] = [
        {
            id: 'tpl-mcp-server',
            type: 'mcp_server',
            name: 'MCP Server Extension',
            description: 'Scaffold for custom MCP servers with runtime permissions and diagnostics.',
            manifest: {
                entrypoint: 'index.ts',
                permissions: ['filesystem.read', 'network.outbound'],
                capabilities: ['tools/list', 'tools/call']
            }
        },
        {
            id: 'tpl-theme',
            type: 'theme',
            name: 'Theme Extension',
            description: 'Theme package manifest for color tokens, icon packs, and typography presets.',
            manifest: {
                entrypoint: 'theme.json',
                permissions: ['ui.theme'],
                capabilities: ['theme/preview', 'theme/apply']
            }
        },
        {
            id: 'tpl-command',
            type: 'command',
            name: 'Command Extension',
            description: 'Slash-command package with command palette integration and argument schema.',
            manifest: {
                entrypoint: 'commands.ts',
                permissions: ['chat.command'],
                capabilities: ['command/register', 'command/execute']
            }
        },
        {
            id: 'tpl-language',
            type: 'language',
            name: 'Language Extension',
            description: 'Language tools extension for syntax, formatter bridges, and language assistants.',
            manifest: {
                entrypoint: 'language.ts',
                permissions: ['editor.syntax', 'editor.format'],
                capabilities: ['language/detect', 'language/tools']
            }
        },
        {
            id: 'tpl-agent-template',
            type: 'agent_template',
            name: 'Agent Template Extension',
            description: 'Agent persona and workflow template package for reusable task automation.',
            manifest: {
                entrypoint: 'agent-template.json',
                permissions: ['agent.profile'],
                capabilities: ['agent/template', 'agent/config']
            }
        },
        {
            id: 'tpl-widget',
            type: 'widget',
            name: 'Widget Extension',
            description: 'Dashboard widget and sidebar panel extension manifest.',
            manifest: {
                entrypoint: 'widget.tsx',
                permissions: ['ui.widget'],
                capabilities: ['widget/render', 'widget/message']
            }
        },
        {
            id: 'tpl-integration',
            type: 'integration',
            name: 'Integration Extension',
            description: 'External integration template with OAuth and credential lifecycle support.',
            manifest: {
                entrypoint: 'integration.ts',
                permissions: ['network.oauth', 'secrets.read'],
                capabilities: ['integration/connect', 'integration/webhook']
            }
        }
    ];
    private readonly GITHUB_API = 'https://api.github.com/repos/modelcontextprotocol/servers/contents/src';
    private readonly FALLBACK_SERVERS: McpMarketplaceServer[] = [
        // Reference Servers (Official)
        {
            id: 'fetch',
            name: 'Fetch',
            description: 'Web content fetching and conversion for efficient LLM usage',
            publisher: 'Model Context Protocol',
            command: 'npx -y @modelcontextprotocol/server-fetch',
            categories: ['Web', 'Utility'],
            isOfficial: true,
            license: 'MIT'
        },
        {
            id: 'filesystem',
            name: 'Filesystem',
            description: 'Secure file operations with configurable access controls',
            publisher: 'Model Context Protocol',
            command: 'npx -y @modelcontextprotocol/server-filesystem',
            categories: ['Filesystem', 'Utility'],
            isOfficial: true,
            license: 'MIT'
        },
        {
            id: 'git',
            name: 'Git',
            description: 'Tools to read, search, and manipulate Git repositories',
            publisher: 'Model Context Protocol',
            command: 'npx -y @modelcontextprotocol/server-git',
            categories: ['Developer Tools', 'VCS'],
            isOfficial: true,
            license: 'MIT'
        },
        {
            id: 'memory',
            name: 'Memory',
            description: 'Knowledge graph-based persistent memory system',
            publisher: 'Model Context Protocol',
            command: 'npx -y @modelcontextprotocol/server-memory',
            categories: ['AI', 'Utility'],
            isOfficial: true,
            license: 'MIT'
        },
        {
            id: 'github',
            name: 'GitHub',
            description: 'Repository management, issues, and pull requests',
            publisher: 'Model Context Protocol',
            command: 'npx -y @modelcontextprotocol/server-github',
            categories: ['Developer Tools', 'VCS'],
            isOfficial: true,
            license: 'MIT'
        },
        {
            id: 'postgres',
            name: 'PostgreSQL',
            description: 'Query and manage PostgreSQL databases',
            publisher: 'Model Context Protocol',
            command: 'npx -y @modelcontextprotocol/server-postgres',
            categories: ['Database'],
            isOfficial: true,
            license: 'MIT'
        },
        {
            id: 'sqlite',
            name: 'SQLite',
            description: 'Local database management',
            publisher: 'Model Context Protocol',
            command: 'npx -y @modelcontextprotocol/server-sqlite',
            categories: ['Database'],
            isOfficial: true,
            license: 'MIT'
        },
        {
            id: 'brave-search',
            name: 'Brave Search',
            description: 'Privacy-focused web search capabilities',
            publisher: 'Brave',
            command: 'npx -y @modelcontextprotocol/server-brave-search',
            categories: ['Web', 'Search'],
            isOfficial: true,
            license: 'MIT'
        },
        {
            id: 'puppeteer',
            name: 'Puppeteer',
            description: 'Headless browser automation',
            publisher: 'Model Context Protocol',
            command: 'npx -y @modelcontextprotocol/server-puppeteer',
            categories: ['Web', 'Automation'],
            isOfficial: true,
            license: 'MIT'
        },
        {
            id: 'slack',
            name: 'Slack',
            description: 'Messaging and team collaboration',
            publisher: 'Model Context Protocol',
            command: 'npx -y @modelcontextprotocol/server-slack',
            categories: ['Productivity', 'Communication'],
            isOfficial: true,
            license: 'MIT'
        },
        {
            id: 'notion',
            name: 'Notion',
            description: 'Workspace for notes, docs, and databases',
            publisher: 'Notion',
            command: 'npx -y @makenotion/mcp-server-notion',
            categories: ['Productivity', 'Database'],
            isOfficial: true,
            license: 'MIT'
        },
        {
            id: 'google-drive',
            name: 'Google Drive',
            description: 'File storage and synchronization',
            publisher: 'Model Context Protocol',
            command: 'npx -y @modelcontextprotocol/server-google-drive',
            categories: ['Productivity', 'Cloud'],
            isOfficial: true,
            license: 'MIT'
        },
        {
            id: 'gitlab',
            name: 'GitLab',
            description: 'CI/CD, source control, and work tracking',
            publisher: 'Model Context Protocol',
            command: 'npx -y @modelcontextprotocol/server-gitlab',
            categories: ['Developer Tools', 'VCS'],
            isOfficial: true,
            license: 'MIT'
        },
        {
            id: 'docker',
            name: 'Docker',
            description: 'Manage containers, images, and volumes',
            publisher: 'Model Context Protocol',
            command: 'npx -y @modelcontextprotocol/server-docker',
            categories: ['DevOps', 'Containers'],
            isOfficial: true,
            license: 'MIT'
        },
        {
            id: 'kubernetes',
            name: 'Kubernetes',
            description: 'Cluster operations and pod management',
            publisher: 'Model Context Protocol',
            command: 'npx -y @modelcontextprotocol/server-kubernetes',
            categories: ['DevOps', 'Containers'],
            isOfficial: true,
            license: 'MIT'
        },
        {
            id: 'aws',
            name: 'AWS',
            description: 'Manage EC2, S3, and other AWS resources',
            publisher: 'Model Context Protocol',
            command: 'npx -y @modelcontextprotocol/server-aws',
            categories: ['Cloud', 'DevOps'],
            isOfficial: true,
            license: 'MIT'
        },
        {
            id: 'cloudflare',
            name: 'Cloudflare',
            description: 'Manage Workers, DNS, and cached content',
            publisher: 'Model Context Protocol',
            command: 'npx -y @modelcontextprotocol/server-cloudflare',
            categories: ['Cloud', 'DevOps'],
            isOfficial: true,
            license: 'MIT'
        },
        {
            id: 'redis',
            name: 'Redis',
            description: 'In-memory data structure store',
            publisher: 'Model Context Protocol',
            command: 'npx -y @modelcontextprotocol/server-redis',
            categories: ['Database', 'Cache'],
            isOfficial: true,
            license: 'MIT'
        },
        {
            id: 'mongodb',
            name: 'MongoDB',
            description: 'NoSQL database interactions',
            publisher: 'MongoDB',
            command: 'npx -y @mongodb-js/mcp-server-mongodb',
            categories: ['Database'],
            isOfficial: true,
            license: 'Apache-2.0'
        },
        {
            id: 'sentry',
            name: 'Sentry',
            description: 'Error tracking and performance monitoring',
            publisher: 'Model Context Protocol',
            command: 'npx -y @modelcontextprotocol/server-sentry',
            categories: ['DevOps', 'Monitoring'],
            isOfficial: true,
            license: 'MIT'
        }
    ];

    constructor() {
        super('McpMarketplaceService');
        // Cache warming: keep known fallback servers available immediately.
        this.cache.warm([{
            key: this.CACHE_KEY_ALL,
            value: this.FALLBACK_SERVERS,
            hotTtl: 30 * 1000,
            warmTtl: this.CACHE_TTL_MS
        }]);
    }

    override async initialize(): Promise<void> {
        this.logInfo('Initializing MCP Marketplace Service...');
        // Pre-load cache on startup
        await this.listServers();
    }

    private normalizeApiItem(item: TengraMarketplaceResponseItem): McpMarketplaceServer | null {
        const sourceId = item.id?.trim() || item.name?.trim();
        if (!sourceId) {
            return null;
        }
        const id = sourceId.toLowerCase().replace(/\s+/g, '-');
        return this.normalizeExtensionType({
            id,
            name: item.name?.trim() || sourceId,
            description: item.description?.trim() || `Marketplace extension ${sourceId}`,
            publisher: item.publisher?.trim() || 'Tengra Marketplace',
            version: item.version,
            categories: item.categories,
            tags: item.tags,
            repository: item.repository,
            npmPackage: item.npmPackage,
            command: item.command,
            license: item.license,
            downloads: item.downloads,
            rating: item.rating,
            isOfficial: item.isOfficial ?? false,
            extensionType: item.extensionType,
            capabilities: item.capabilities,
            dependencies: item.dependencies,
            conflictsWith: item.conflictsWith,
            settingsVersion: 1,
            updatePolicy: { channel: 'stable', autoUpdate: true },
            storage: { quotaMb: 256 }
        });
    }

    private normalizeApiPayload(payload: unknown): McpMarketplaceServer[] {
        const data = payload as
            | TengraMarketplaceResponseItem[]
            | {
                items?: TengraMarketplaceResponseItem[];
                servers?: TengraMarketplaceResponseItem[];
                extensions?: TengraMarketplaceResponseItem[];
                themes?: TengraMarketplaceResponseItem[];
            };
        const list = Array.isArray(data)
            ? data
            : [
                ...(Array.isArray(data.items) ? data.items : []),
                ...(Array.isArray(data.servers) ? data.servers : []),
                ...(Array.isArray(data.extensions) ? data.extensions : []),
                ...(Array.isArray(data.themes) ? data.themes : [])
            ];
        const mapped = list
            .map(item => this.normalizeApiItem(item))
            .filter((item): item is McpMarketplaceServer => item !== null);
        return Array.from(new Map(mapped.map(item => [item.id, item])).values());
    }

    private isTransientMarketplaceError(error: unknown): boolean {
        if (!axios.isAxiosError(error)) {
            return false;
        }
        if (error.code === 'ECONNABORTED') {
            return true;
        }
        if (!error.response) {
            return true;
        }
        return error.response.status === 429 || error.response.status >= 500;
    }

    private async getWithRetry<T>(url: string, config: AxiosRequestConfig, attempts = 3): Promise<T> {
        let lastError: unknown;
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
            this.fetchTelemetry.totalRequests += 1;
            try {
                const response = await axios.get<T>(url, config);
                return response.data;
            } catch (error) {
                lastError = error;
                if (!this.isTransientMarketplaceError(error) || attempt === attempts) {
                    throw error;
                }
                this.fetchTelemetry.transientFailures += 1;
                this.fetchTelemetry.totalRetries += 1;
                await new Promise(resolve => setTimeout(resolve, attempt * 200));
            }
        }
        throw lastError;
    }

    /**
     * List all available MCP servers from GitHub repository
     */
    async listServers(): Promise<McpMarketplaceServer[]> {
        const cached = this.cache.get(this.CACHE_KEY_ALL);
        if (cached !== undefined && cached.length > 0 && this.hasLoadedRemoteCatalog) {
            return cached;
        }

        try {
            const apiPayload = await this.getWithRetry<unknown>(
                this.TENGRA_MARKETPLACE_API,
                {
                    timeout: 10000,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Tengra-MCP-Marketplace'
                    }
                }
            );
            const apiServers = this.normalizeApiPayload(apiPayload);
            if (apiServers.length > 0) {
                this.cache.set(this.CACHE_KEY_ALL, apiServers, { warm: this.CACHE_TTL_MS });
                this.hasLoadedRemoteCatalog = true;
                this.logInfo(`Loaded ${apiServers.length} servers from Tengra marketplace API`);
                return apiServers;
            }
        } catch (error) {
            this.logWarn('Failed to fetch Tengra marketplace API, trying GitHub source');
            this.fetchTelemetry.lastFailureAt = Date.now();
            this.fetchTelemetry.transientFailures += 1;
            this.logDebug(
                'Tengra marketplace API error details',
                error instanceof Error ? error : undefined
            );
        }

        try {
            // Fetch from GitHub API
            const directoriesPayload = await this.getWithRetry<Array<{ name: string; type: string; path: string }>>(
                this.GITHUB_API,
                {
                    timeout: 10000,
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'Tengra-MCP-Marketplace'
                    }
                }
            );

            if (directoriesPayload && Array.isArray(directoriesPayload)) {
                const servers: McpMarketplaceServer[] = [];

                // Filter only directories (each MCP server is in its own directory)
                const directories = directoriesPayload.filter(item => item.type === 'dir');

                // Fetch package.json files in batches to avoid rate limiting
                const BATCH_SIZE = 5;
                for (let i = 0; i < directories.length; i += BATCH_SIZE) {
                    const batch = directories.slice(i, i + BATCH_SIZE);
                    const batchPromises = batch.map(async (dir): Promise<McpMarketplaceServer | null> => {
                        try {
                            const packageUrl = `https://raw.githubusercontent.com/modelcontextprotocol/servers/main/src/${dir.name}/package.json`;
                            const pkg = await this.getWithRetry<MarketplacePackageManifest>(
                                packageUrl,
                                { timeout: 5000 },
                                2
                            );

                            const server: McpMarketplaceServer = {
                                id: dir.name,
                                name: pkg.name ?? dir.name,
                                description: pkg.description ?? `MCP server for ${dir.name}`,
                                publisher: resolveAuthorName(pkg.author) ?? 'Model Context Protocol',
                                version: pkg.version,
                                command: `npx -y ${pkg.name}`,
                                repository: pkg.repository?.url ?? `https://github.com/modelcontextprotocol/servers/tree/main/src/${dir.name}`,
                                license: pkg.license,
                                categories: this.inferCategories(dir.name, pkg.description),
                                extensionType: this.inferExtensionType(dir.name, pkg.description),
                                isOfficial: true,
                                capabilities: this.inferCategories(dir.name, pkg.description),
                                dependencies: [],
                                conflictsWith: [],
                                settingsVersion: 1,
                                updatePolicy: { channel: 'stable', autoUpdate: true },
                                storage: { quotaMb: 256 }
                            };
                            return server;
                        } catch (error) {
                            // Some directories in the MCP servers repo do not contain package.json at this path.
                            // For these expected 404s, fallback to known metadata (if available) or skip silently.
                            if (axios.isAxiosError(error) && error.response?.status === 404) {
                                const fallback = this.FALLBACK_SERVERS.find(
                                    server => server.id === dir.name
                                );
                                if (fallback) {
                                    return fallback;
                                }
                                this.logDebug(
                                    `Skipping ${dir.name}: package.json not found at expected path`
                                );
                                return null;
                            }

                            this.logError(`Failed to load package.json for ${dir.name}`, error);
                            return null;
                        }
                    });

                    const batchResults = await Promise.all(batchPromises);
                    const validServers = batchResults.filter((s): s is McpMarketplaceServer => s !== null);
                    servers.push(...validServers);

                    // Small delay between batches
                    if (i + BATCH_SIZE < directories.length) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }

                this.cache.set(this.CACHE_KEY_ALL, servers, { warm: this.CACHE_TTL_MS });
                this.logInfo(
                    `Loaded ${servers.length} servers from GitHub (cache hitRate=${(this.cache.stats().hitRate * 100).toFixed(1)}%, retries=${this.fetchTelemetry.totalRetries})`
                );
                this.hasLoadedRemoteCatalog = true;
                return servers.map(server => this.normalizeExtensionType(server));
            }
        } catch (error) {
            this.logError('Failed to fetch from GitHub, using fallback', error);
            this.fetchTelemetry.fallbackUsages += 1;
            this.fetchTelemetry.lastFailureAt = Date.now();
        }

        // Fallback to hardcoded list
        const fallbackServers = this.FALLBACK_SERVERS.map(server => this.normalizeExtensionType(server));
        this.cache.set(this.CACHE_KEY_ALL, fallbackServers, { warm: this.CACHE_TTL_MS });
        this.logInfo(`Using fallback servers: ${this.FALLBACK_SERVERS.length}`);
        this.hasLoadedRemoteCatalog = true;
        return fallbackServers;
    }

    /**
     * Infer categories from server name and description
     */
    private inferCategories(name: string, description?: string): string[] {
        const categories: string[] = [];
        const text = `${name} ${description ?? ''}`.toLowerCase();

        if (text.includes('github') || text.includes('git') || text.includes('gitlab')) {
            categories.push('Developer Tools', 'VCS');
        }
        if (text.includes('database') || text.includes('postgres') || text.includes('mysql') || text.includes('sqlite')) {
            categories.push('Database');
        }
        if (text.includes('web') || text.includes('fetch') || text.includes('http')) {
            categories.push('Web');
        }
        if (text.includes('filesystem') || text.includes('file')) {
            categories.push('Filesystem', 'Utility');
        }
        if (text.includes('memory') || text.includes('knowledge')) {
            categories.push('AI', 'Utility');
        }
        if (text.includes('slack') || text.includes('discord') || text.includes('notion')) {
            categories.push('Productivity');
        }
        if (text.includes('docker') || text.includes('kubernetes') || text.includes('aws')) {
            categories.push('Cloud', 'DevOps');
        }
        if (text.includes('search') || text.includes('brave')) {
            categories.push('Web', 'Search');
        }

        return categories.length > 0 ? categories : ['Utility'];
    }

    private inferExtensionType(
        name: string,
        description?: string
    ): McpMarketplaceServer['extensionType'] {
        const text = `${name} ${description ?? ''}`.toLowerCase();
        if (text.includes('theme') || text.includes('color') || text.includes('icon pack')) {
            return 'theme';
        }
        if (text.includes('command') || text.includes('slash')) {
            return 'command';
        }
        if (text.includes('language') || text.includes('formatter') || text.includes('syntax')) {
            return 'language';
        }
        if (text.includes('agent template') || text.includes('persona')) {
            return 'agent_template';
        }
        if (text.includes('widget') || text.includes('dashboard')) {
            return 'widget';
        }
        if (text.includes('oauth') || text.includes('integration') || text.includes('webhook')) {
            return 'integration';
        }
        return 'mcp_server';
    }

    private normalizeExtensionType(server: McpMarketplaceServer): McpMarketplaceServer {
        return {
            ...server,
            extensionType: server.extensionType ?? this.inferExtensionType(server.id, server.description)
        };
    }

    getExtensionTemplates(): McpExtensionTemplate[] {
        return this.EXTENSION_TEMPLATES.map(template => ({ ...template, manifest: { ...template.manifest, permissions: [...template.manifest.permissions], capabilities: [...template.manifest.capabilities] } }));
    }

    createExtensionDraft(payload: {
        id: string;
        name: string;
        type: McpExtensionTemplate['type'];
        publisher: string;
    }): McpMarketplaceServer {
        const template = this.EXTENSION_TEMPLATES.find(item => item.type === payload.type);
        if (!template) {
            throw new Error(`Unknown extension template type: ${payload.type}`);
        }
        const nowVersion = '0.1.0';
        return {
            id: payload.id,
            name: payload.name,
            description: template.description,
            publisher: payload.publisher,
            version: nowVersion,
            extensionType: payload.type,
            command: template.manifest.entrypoint,
            categories: template.manifest.capabilities,
            capabilities: template.manifest.capabilities,
            dependencies: [],
            conflictsWith: [],
            isOfficial: false,
            settingsVersion: 1,
            storage: { quotaMb: 128 }
        };
    }

    /**
     * Search servers by query
     */
    async searchServers(query: string): Promise<McpMarketplaceServer[]> {
        const servers = await this.listServers();
        const lowerQuery = query.toLowerCase();

        return servers.filter(server =>
            server.name.toLowerCase().includes(lowerQuery) ||
            server.description.toLowerCase().includes(lowerQuery) ||
            server.publisher.toLowerCase().includes(lowerQuery) ||
            server.categories?.some(cat => cat.toLowerCase().includes(lowerQuery)) ||
            server.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }

    /**
     * Filter servers by category
     */
    async filterByCategory(category: string): Promise<McpMarketplaceServer[]> {
        const servers = await this.listServers();

        if (category === 'all') {
            return servers;
        }

        return servers.filter(server =>
            server.categories?.some(cat => cat.toLowerCase() === category.toLowerCase())
        );
    }

    /**
     * Get unique categories from all servers
     */
    async getCategories(): Promise<string[]> {
        const servers = await this.listServers();
        const categoriesSet = new Set<string>();

        servers.forEach(server => {
            server.categories?.forEach(cat => categoriesSet.add(cat));
        });

        return Array.from(categoriesSet).sort();
    }

    /**
     * Clear cache to force refresh
     */
    async refreshCache(): Promise<void> {
        this.cache.clear();
        this.hasLoadedRemoteCatalog = false;
        await this.listServers();
    }

    override async cleanup(): Promise<void> {
        this.cache.clear();
    }
}

