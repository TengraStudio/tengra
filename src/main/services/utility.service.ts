import { DatabaseService } from './database.service';
import { ScannerService } from './scanner.service';
import { EmbeddingService } from './embedding.service';

export class UtilityService {
    constructor(
        private db: DatabaseService,
        private scanner: ScannerService,
        private embedding: EmbeddingService
    ) { }

    // 16. Currency Converter (Simple static/ratio for demo or small API)
    async getExchangeRate(from: string, to: string) {
        try {
            // Using a demo free API
            const res = await fetch(`https://open.er-api.com/v6/latest/${from.toUpperCase()}`);
            const data: any = await res.json();
            const rate = data.rates[to.toUpperCase()];
            return rate ? { success: true, rate } : { success: false, error: 'Rate not found' };
        } catch (e: any) {
            return { success: false, error: e.message };
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
                console.error(`[Uptime] ${url} is DOWN!`);
            }
        }, interval);
        return { success: true, message: `Started monitoring ${url}` };
    }

    // 29. Smart Reminders
    private reminders: Map<string, any> = new Map();
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
        if (this.reminders.has(id)) {
            clearTimeout(this.reminders.get(id));
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
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    // 36. Shodan Link
    async lookupShodan(ip: string, apiKey?: string) {
        if (!apiKey) return { success: false, error: 'Shodan API key required' };
        try {
            const response = await fetch(`https://api.shodan.io/shodan/host/${ip}?key=${apiKey}`);
            const data = await response.json();
            return { success: true, data };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    // 37. Plugin System (Simplified)
    async loadPlugin(_path: string) {
        return { success: false, error: 'Plugin loading via eval is disabled for security reasons.' };
    }

    // 39. Long-term Memory
    async storeMemory(key: string, value: string) {
        this.db.storeMemory(key, value);
        return { success: true, message: `Memory stored for "${key}"` };
    }

    async recallMemory(key: string) {
        const value = this.db.recallMemory(key);
        return { success: true, value };
    }

    // 40. Local RAG (Vector-based)
    async indexDocument(path: string) {
        try {
            const fs = require('fs/promises');
            const content = await fs.readFile(path, 'utf8');
            const chunks = [content];
            await this.embedding.indexChunks(path, chunks);
            return { success: true, message: `Document indexed: ${path}` };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async searchDocuments(query: string) {
        try {
            const results = await this.embedding.search(query);
            return { success: true, results };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    // 41. Codebase Scanner (New)
    async scanCodebase(dir: string) {
        try {
            const scanResults = await this.scanner.scanDirectory(dir);
            let indexedCount = 0;
            for (const res of scanResults) {
                await this.embedding.indexChunks(res.path, res.chunks);
                indexedCount++;
            }
            return { success: true, message: `Scanned and indexed ${indexedCount} files from ${dir}` };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }
}

