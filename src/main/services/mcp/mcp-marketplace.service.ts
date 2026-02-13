import { BaseService } from '@main/services/base.service';
import { MultiLevelCache } from '@main/utils/cache.util';
import axios from 'axios';

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
            description: 'CI/CD, source control, and project management',
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

    /**
     * List all available MCP servers from GitHub repository
     */
    async listServers(): Promise<McpMarketplaceServer[]> {
        const cached = this.cache.get(this.CACHE_KEY_ALL);
        if (cached !== undefined && cached.length > 0) {
            return cached;
        }

        try {
            // Fetch from GitHub API
            const response = await axios.get<Array<{ name: string; type: string; path: string }>>(
                this.GITHUB_API,
                {
                    timeout: 10000,
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'Tandem-MCP-Marketplace'
                    }
                }
            );

            if (response.data && Array.isArray(response.data)) {
                const servers: McpMarketplaceServer[] = [];

                // Filter only directories (each MCP server is in its own directory)
                const directories = response.data.filter(item => item.type === 'dir');

                // Fetch package.json files in batches to avoid rate limiting
                const BATCH_SIZE = 5;
                for (let i = 0; i < directories.length; i += BATCH_SIZE) {
                    const batch = directories.slice(i, i + BATCH_SIZE);
                    const batchPromises = batch.map(async (dir): Promise<McpMarketplaceServer | null> => {
                        try {
                            const packageUrl = `https://raw.githubusercontent.com/modelcontextprotocol/servers/main/src/${dir.name}/package.json`;
                            const pkgResponse = await axios.get(packageUrl, { timeout: 5000 });
                            const pkg = pkgResponse.data;

                            const server: McpMarketplaceServer = {
                                id: dir.name,
                                name: pkg.name ?? dir.name,
                                description: pkg.description ?? `MCP server for ${dir.name}`,
                                publisher: pkg.author?.name ?? pkg.author ?? 'Model Context Protocol',
                                version: pkg.version,
                                command: `npx -y ${pkg.name}`,
                                repository: pkg.repository?.url ?? `https://github.com/modelcontextprotocol/servers/tree/main/src/${dir.name}`,
                                license: pkg.license,
                                categories: this.inferCategories(dir.name, pkg.description),
                                isOfficial: true
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
                this.logInfo(`Loaded ${servers.length} servers from GitHub (cache hitRate=${(this.cache.stats().hitRate * 100).toFixed(1)}%)`);
                return servers;
            }
        } catch (error) {
            this.logError('Failed to fetch from GitHub, using fallback', error);
        }

        // Fallback to hardcoded list
        this.cache.set(this.CACHE_KEY_ALL, this.FALLBACK_SERVERS, { warm: this.CACHE_TTL_MS });
        this.logInfo(`Using fallback servers: ${this.FALLBACK_SERVERS.length}`);
        return this.FALLBACK_SERVERS;
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
        await this.listServers();
    }

    override async cleanup(): Promise<void> {
        this.cache.clear();
    }
}
