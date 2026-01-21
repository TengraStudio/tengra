import * as fs from 'fs/promises'
import * as path from 'path'

import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

import { JsonValue } from '@/types/common';

export interface ScanResult {
    path: string;
    content: string;
    chunks: string[];
}

export class ContentService {
    private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

    // --- Web & Search ---

    async fetchWebPage(url: string): Promise<{ success: boolean; content?: string; title?: string; error?: string }> {
        try {
            const res = await fetch(url, { headers: { 'User-Agent': this.userAgent } })
            if (!res.ok) { return { success: false, error: `HTTP ${res.status}` } }
            const html = await res.text()
            const content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').trim().slice(0, 15000)
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
            return { success: true, content, title: titleMatch ? titleMatch[1].trim() : '' }
        } catch (e) { return { success: false, error: getErrorMessage(e as Error) } }
    }

    async searchWeb(query: string): Promise<{ success: boolean; results?: { title: string; url: string }[] }> {
        const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`
        try {
            const res = await fetch(url, { headers: { 'User-Agent': this.userAgent } })
            const html = await res.text()
            const matches = [...html.matchAll(/<a[^>]*rel="nofollow"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi)]
            return { success: true, results: matches.map(m => ({ title: m[2].trim(), url: m[1] })) }
        } catch { return { success: false } }
    }

    // --- Content Utilities ---

    base64Encode(text: string): string { return Buffer.from(text).toString('base64') }
    base64Decode(encoded: string): string { return Buffer.from(encoded, 'base64').toString('utf8') }

    async shortenUrl(url: string): Promise<string> {
        const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`)
        return res.text()
    }

    generateQrCodeUrl(text: string): string {
        return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(text)}`
    }

    // --- Local Scanner ---

    async scanDirectory(dirPath: string): Promise<ScanResult[]> {
        const results: ScanResult[] = []
        const ignore = ['node_modules', '.git', 'dist']
        const allowed = ['.ts', '.tsx', '.js', '.jsx', '.py', '.md']

        const walk = async (dir: string) => {
            const files = await fs.readdir(dir, { withFileTypes: true })
            for (const f of files) {
                const full = path.join(dir, f.name)
                if (f.isDirectory()) {
                    if (!ignore.includes(f.name)) { await walk(full) }
                } else if (allowed.includes(path.extname(f.name))) {
                    const content = await fs.readFile(full, 'utf8')
                    results.push({ path: full, content, chunks: [content.slice(0, 1000)] })
                }
            }
        }
        await walk(dirPath)
        return results
    }

    // --- Media ---

    async getYouTubeTranscript(url: string): Promise<string> {
        // Simplified placeholder for the original logic
        return `Transcript for ${url} (Requires complex parsing)`
    }

    formatJson(json: JsonValue): string {
        try {
            return JSON.stringify(typeof json === 'string' ? safeJsonParse(json, {}) : json, null, 2);
        } catch {
            return String(json);
        }
    }
}
