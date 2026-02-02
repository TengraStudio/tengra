import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

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
                        const loc = location ? encodeURIComponent(String(location)) : '';
                        const url = `https://wttr.in/${loc}?format=j1`;
                        return await deps.web.fetchJson(url);
                    }
                }
            ])
        },
        {
            name: 'geo',
            description: 'Geolocation utilities',
            actions: buildActions([
                {
                    name: 'ip',
                    description: 'Get IP location info',
                    handler: async ({ ip }) => {
                        const target = ip ? String(ip) : 'json';
                        const url = `https://ipapi.co/${target}/json/`;
                        return await deps.web.fetchJson(url);
                    }
                }
            ])
        },
        {
            name: 'news',
            description: 'Tech news headlines',
            actions: buildActions([
                {
                    name: 'hackernews',
                    description: 'Get top HackerNews stories',
                    handler: async ({ count }) => {
                        const limit = Number(count) || 10;
                        const idsRes = await deps.web.fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json');
                        if (!idsRes.success || !Array.isArray(idsRes.data)) {
                            return { success: false, error: 'Failed to fetch top stories' };
                        }

                        const ids = (idsRes.data as unknown as number[]).slice(0, limit);
                        const stories = await Promise.all(ids.map(async (id: number) => {
                            const storyRes = await deps.web.fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
                            return storyRes.data;
                        }));

                        return { success: true, data: stories };
                    }
                }
            ])
        },
        {
            name: 'finance',
            description: 'Crypto and Forex info',
            actions: buildActions([
                {
                    name: 'crypto',
                    description: 'Get simple crypto price (e.g. "bitcoin")',
                    handler: async ({ coin, currency }) => {
                        const c = coin ? String(coin).toLowerCase() : 'bitcoin';
                        const vs = currency ? String(currency).toLowerCase() : 'usd';
                        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${c}&vs_currencies=${vs}`;
                        return await deps.web.fetchJson(url);
                    }
                }
            ])
        },
        {
            name: 'time',
            description: 'World time information',
            actions: buildActions([
                {
                    name: 'now',
                    description: 'Get current time for a timezone (e.g. "Europe/London")',
                    handler: async ({ timezone }) => {
                        const tz = timezone ? String(timezone) : 'Etc/UTC';
                        const url = `https://worldtimeapi.org/api/timezone/${tz}`;
                        return await deps.web.fetchJson(url);
                    }
                }
            ])
        }
    ];
}
