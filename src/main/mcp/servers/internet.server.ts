import { buildActions, McpDeps, validateString, validateNumber, withTimeout } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

/**
 * Validates IP address format (IPv4 only for safety)
 */
const validateIPAddress = (ip: unknown): string => {
    const ipStr = validateString(ip, 45); // Max IPv6 length

    // Only allow public IPv4 addresses
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;

    if (!ipv4Pattern.test(ipStr)) {
        throw new Error('Invalid IP address format (only IPv4 supported)');
    }

    // Check each octet is valid
    const octets = ipStr.split('.');
    for (const octet of octets) {
        const num = parseInt(octet, 10);
        if (num < 0 || num > 255) {
            throw new Error('Invalid IP address octets');
        }
    }

    // Prevent private/local IPs (SSRF protection)
    const firstOctet = parseInt(octets[0], 10);
    const secondOctet = parseInt(octets[1], 10);

    if (
        firstOctet === 10 || // 10.0.0.0/8
        firstOctet === 127 || // 127.0.0.0/8 (localhost)
        (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) || // 172.16.0.0/12
        (firstOctet === 192 && secondOctet === 168) || // 192.168.0.0/16
        firstOctet === 0 || // 0.0.0.0/8
        firstOctet >= 224 // Multicast/reserved
    ) {
        throw new Error('Private/local IP addresses not allowed (SSRF protection)');
    }

    return ipStr;
};

/**
 * Validates timezone format
 */
const validateTimezone = (tz: unknown): string => {
    const timezone = validateString(tz, 100);

    // Basic timezone validation (Area/Location format)
    if (!/^[A-Z][a-zA-Z_]+\/[A-Z][a-zA-Z_]+$/.test(timezone) && timezone !== 'Etc/UTC') {
        throw new Error('Invalid timezone format (use Area/Location, e.g., Europe/London)');
    }

    return timezone;
};

export function buildInternetServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'weather',
            description: 'Weather information',
            actions: buildActions([
                {
                    name: 'forecast',
                    description: 'Get weather forecast from wttr.in',
                    handler: async ({ location }) => {
                        const loc = location
                            ? encodeURIComponent(validateString(location, 100))
                            : '';
                        const url = `https://wttr.in/${loc}?format=j1`;

                        return await withTimeout(
                            () => deps.web.fetchJson(url),
                            10000
                        );
                    }
                }
            ], 'weather', deps.auditLog)
        },
        {
            name: 'geo',
            description: 'Geolocation utilities',
            actions: buildActions([
                {
                    name: 'ip',
                    description: 'Get IP location info (public IPs only - SSRF protected)',
                    handler: async ({ ip }) => {
                        const target = ip ? validateIPAddress(ip) : 'json';
                        const url = `https://ipapi.co/${target}/json/`;

                        return await withTimeout(
                            () => deps.web.fetchJson(url),
                            10000
                        );
                    }
                }
            ], 'geo', deps.auditLog)
        },
        {
            name: 'news',
            description: 'Tech news headlines',
            actions: buildActions([
                {
                    name: 'hackernews',
                    description: 'Get top HackerNews stories (max 30)',
                    handler: async ({ count }) => {
                        const limit = validateNumber(count ?? 10, 1, 30);

                        const idsRes = await withTimeout(
                            () => deps.web.fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json'),
                            10000
                        );

                        if (!idsRes.success || !Array.isArray(idsRes.data)) {
                            return { success: false, error: 'Failed to fetch top stories' };
                        }

                        const ids = (idsRes.data as unknown as number[]).slice(0, limit);

                        // Fetch stories with limited concurrency
                        const stories = await Promise.all(
                            ids.map(async (id: number) => {
                                const storyRes = await withTimeout(
                                    () => deps.web.fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`),
                                    5000
                                );
                                return storyRes.data;
                            })
                        );

                        return { success: true, data: stories };
                    }
                }
            ], 'news', deps.auditLog)
        },
        {
            name: 'finance',
            description: 'Crypto and Forex info',
            actions: buildActions([
                {
                    name: 'crypto',
                    description: 'Get simple crypto price (e.g. "bitcoin")',
                    handler: async ({ coin, currency }) => {
                        const c = coin
                            ? validateString(coin, 50).toLowerCase()
                            : 'bitcoin';
                        const vs = currency
                            ? validateString(currency, 10).toLowerCase()
                            : 'usd';

                        // Validate coin/currency format (alphanumeric only)
                        if (!/^[a-z0-9-]+$/.test(c) || !/^[a-z]{3}$/.test(vs)) {
                            throw new Error('Invalid coin or currency format');
                        }

                        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${c}&vs_currencies=${vs}`;

                        return await withTimeout(
                            () => deps.web.fetchJson(url),
                            10000
                        );
                    }
                }
            ], 'finance', deps.auditLog)
        },
        {
            name: 'time',
            description: 'World time information',
            actions: buildActions([
                {
                    name: 'now',
                    description: 'Get current time for a timezone (e.g. "Europe/London")',
                    handler: async ({ timezone }) => {
                        const tz = timezone ? validateTimezone(timezone) : 'Etc/UTC';
                        const url = `https://worldtimeapi.org/api/timezone/${tz}`;

                        return await withTimeout(
                            () => deps.web.fetchJson(url),
                            10000
                        );
                    }
                }
            ], 'time', deps.auditLog)
        }
    ];
}
