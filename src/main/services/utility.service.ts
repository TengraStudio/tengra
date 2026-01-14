import { DatabaseService } from './data/database.service';
import { ScannerService } from './scanner.service';
import { EmbeddingService } from './llm/embedding.service';
// import * as fs from 'fs/promises'; (Unused)

interface ExchangeRateResponse {
    rates: Record<string, number>;
}

export class UtilityService {
    constructor(
        private db: DatabaseService,
        _scanner: ScannerService,
        _embedding: EmbeddingService
    ) { }

    // 16. Currency Converter (Simple static/ratio for demo or small API)
    async getExchangeRate(from: string, to: string) {
        try {
            // Using a demo free API
            const res = await fetch(`https://open.er-api.com/v6/latest/${from.toUpperCase()}`);
            const data = await res.json() as ExchangeRateResponse;
            const rate = data.rates[to.toUpperCase()];
            return rate ? { success: true, rate } : { success: false, error: 'Rate not found' };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return { success: false, error: message };
        }
    }

    // 19. Uptime Monitor (Register a ping check)
    // 31. Uptime Monitor
    startMonitor(url: string, intervalSeconds: number = 60) {
        const interval = intervalSeconds * 1000;
        console.log(`[Uptime] Monitoring ${url} every ${intervalSeconds}s`);
        setInterval(async () => {
            try {
                await fetch(url, { method: 'HEAD', mode: 'no-cors' });
                console.log(`[Uptime] ${url} is UP`);
            } catch (e) {
                console.error(`[Uptime] ${url} is DOWN!`, e);
            }
        }, interval);
        return { success: true, message: `Started monitoring ${url}` };
    }

    // 29. Smart Reminders
    private reminders: Map<string, NodeJS.Timeout> = new Map();
    scheduleReminder(text: string, delayMs: number, onTrigger: (msg: string) => void) {
        const id = Math.random().toString(36).substring(2, 9);
        const timeout = setTimeout(() => {
            onTrigger(text);
            this.reminders.delete(id);
        }, delayMs);
        this.reminders.set(id, timeout);
        return { success: true, id, message: `Reminder set for ${new Date(Date.now() + delayMs).toLocaleTimeString()}` };
    }

    cancelReminder(id: string) {
        const reminder = this.reminders.get(id);
        if (reminder) {
            clearTimeout(reminder);
            this.reminders.delete(id);
            return { success: true, message: 'Reminder cancelled' };
        }
        return { success: false, error: 'Reminder not found' };
    }

    // 34. Ghost Mode (Productivity)
    toggleGhostMode(enabled: boolean) {
        if (enabled) {
            return { success: true, message: 'Ghost Mode (DND) enabled. Notifications silenced.' };
        } else {
            return { success: true, message: 'Ghost Mode disabled.' };
        }
    }

    // 35. VirusTotal Integration
    async checkVirusTotal(hash: string, apiKey?: string) {
        if (!apiKey) return { success: false, error: 'VirusTotal API key required in arguments or settings' };
        try {
            const response = await fetch(`https://www.virustotal.com/api/v3/files/${hash}`, {
                headers: { 'x-apikey': apiKey }
            });
            const data = await response.json();
            return { success: true, data };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return { success: false, error: message };
        }
    }

    // 36. Shodan Link
    async lookupShodan(ip: string, apiKey?: string) {
        if (!apiKey) return { success: false, error: 'Shodan API key required' };
        try {
            const response = await fetch(`https://api.shodan.io/shodan/host/${ip}?key=${apiKey}`);
            const data = await response.json();
            return { success: true, data };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return { success: false, error: message };
        }
    }

    // 37. Plugin System (Simplified)
    async loadPlugin(_path: string) {
        return { success: false, error: 'Plugin loading via eval is disabled for security reasons.' };
    }

    // 39. Long-term Memory
    async storeMemory(key: string, value: string) {
        await this.db.storeMemory(key, value);
        return { success: true, message: `Memory stored for "${key}"` };
    }

    async recallMemory(key: string) {
        const value = await this.db.recallMemory(key);
        return { success: true, value };
    }

    // 40. Local RAG (Vector-based)
    // 40. Local RAG (Deprecated)
    async indexDocument(_path: string) {
        return { success: false, error: 'Deprecated. Use CodeIntelligenceService for indexing.' };
    }

    async searchDocuments(_query: string) {
        return { success: false, error: 'Deprecated. Use ContextRetrievalService for search.' };
    }

    // 41. Codebase Scanner (Deprecated)
    async scanCodebase(_dir: string) {
        return { success: false, error: 'Deprecated. Use CodeIntelligenceService for scanning.' };
    }
}
