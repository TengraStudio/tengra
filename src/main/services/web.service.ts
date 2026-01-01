// Web service using native fetch and simplified HTML parsing (Electron compatible)

interface WebResult {
    success: boolean
    content?: string
    title?: string
    error?: string
}

interface SearchResult {
    title: string
    url: string
    snippet: string
}

export class WebService {
    private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

    async fetchWebPage(url: string): Promise<WebResult> {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5'
                }
            })

            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}` }
            }

            const html = await response.text()

            // Simple HTML to text extraction
            let content = html
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
                .slice(0, 15000)

            // Extract title
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
            const title = titleMatch ? titleMatch[1].trim() : ''

            return { success: true, content, title }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    async searchWeb(query: string, numResults: number = 5): Promise<{ success: boolean; results?: SearchResult[]; error?: string }> {
        try {
            // Using DuckDuckGo Lite (simpler HTML)
            const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`

            const response = await fetch(searchUrl, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html'
                }
            })

            const html = await response.text()
            const results: SearchResult[] = []

            // Simple regex-based extraction for DuckDuckGo Lite results
            const linkRegex = /<a[^>]*rel="nofollow"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi
            const matches = [...html.matchAll(linkRegex)]

            for (let i = 0; i < Math.min(matches.length, numResults); i++) {
                const match = matches[i]
                if (match[1] && match[2]) {
                    results.push({
                        title: match[2].trim(),
                        url: match[1],
                        snippet: ''
                    })
                }
            }

            return { success: true, results }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    async fetchJson(url: string): Promise<{ success: boolean; data?: any; error?: string }> {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json'
                }
            })

            return { success: true, data: await response.json() }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }
}
