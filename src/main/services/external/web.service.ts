/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Web service using native fetch and simplified HTML parsing (Electron compatible)
import { JsonValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';

interface WebResult {
    success: boolean
    content?: string
    title?: string
    error?: string
    [key: string]: JsonValue | undefined;
}

interface SearchResult {
    title: string
    url: string
    snippet: string
    [key: string]: JsonValue | undefined;
}

export class WebService {
    static readonly serviceName = 'webService';
    static readonly dependencies = [] as const;
    private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    private tavilyApiKey: string | null = null;

    /**
     * Set Tavily API key for advanced search
     */
    setTavilyKey(key: string): void {
        this.tavilyApiKey = key;
    }

    async fetchWebPage(url: string): Promise<WebResult> {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5'
                }
            });

            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}` };
            }

            const html = await response.text();

            // Simple HTML to text extraction
            const content = html
                // Remove scripts and styles
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
                .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
                .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
                // Remove HTML tags
                .replace(/<[^>]+>/g, ' ')
                // Decode HTML entities
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                // Clean up whitespace
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 15000);

            // Extract title
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            const title = titleMatch ? titleMatch[1].trim() : '';

            return { success: true, content, title };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    /**
     * Search the web using available providers
     */
    async searchWeb(query: string, numResults: number = 5): Promise<{ success: boolean; results?: SearchResult[]; error?: string }> {
        if (this.tavilyApiKey) {
            return await this.searchTavily(query, numResults);
        }
        return await this.searchDuckDuckGo(query, numResults);
    }

    /**
     * Search using Tavily API (v1)
     */
    private async searchTavily(query: string, numResults: number): Promise<{ success: boolean; results?: SearchResult[]; error?: string }> {
        try {
            const response = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    api_key: this.tavilyApiKey,
                    query,
                    search_depth: 'basic',
                    max_results: numResults,
                    include_answer: false,
                    include_images: false,
                    include_raw_content: false
                })
            });

            if (!response.ok) {
                const errorData = await response.json() as { detail?: string };
                return { success: false, error: `Tavily API error: ${errorData.detail ?? response.statusText}` };
            }

            const data = await response.json() as {
                results: Array<{ title: string; url: string; content: string }>
            };

            const results: SearchResult[] = data.results.map(r => ({
                title: r.title,
                url: r.url,
                snippet: r.content
            }));

            return { success: true, results };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    /**
     * Search using DuckDuckGo Lite (fallback)
     */
    private async searchDuckDuckGo(query: string, numResults: number): Promise<{ success: boolean; results?: SearchResult[]; error?: string }> {
        try {
            // Using DuckDuckGo Lite (simpler HTML)
            const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;

            const response = await fetch(searchUrl, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html'
                }
            });

            const html = await response.text();
            const results: SearchResult[] = [];

            // Simple regex-based extraction for DuckDuckGo Lite results
            const linkRegex = /<a[^>]*rel="nofollow"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
            const matches = [...html.matchAll(linkRegex)];

            for (let i = 0; i < Math.min(matches.length, numResults); i++) {
                const match = matches[i];
                if (match[1] && match[2]) {
                    results.push({
                        title: match[2].trim(),
                        url: match[1],
                        snippet: ''
                    });
                }
            }

            return { success: true, results };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async fetchJson(url: string): Promise<{ success: boolean; data?: JsonValue; error?: string }> {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json'
                }
            });

            return { success: true, data: await response.json() as JsonValue };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }
}

