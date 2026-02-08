import { randomBytes } from 'crypto';

import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { SecurityService } from '@main/services/security/security.service';

interface ExchangeRateResponse {
    rates: Record<string, number>;
}

// QUAL-002-2: Extract configurable API URLs
const EXCHANGE_RATE_API_BASE = 'https://open.er-api.com/v6/latest';

export class UtilityService extends BaseService {
    private monitors: Map<string, NodeJS.Timeout> = new Map();

    constructor(
        private db: DatabaseService,
        private security: SecurityService
    ) {
        super('UtilityService');
    }

    override async cleanup(): Promise<void> {
        // Stop all monitors
        for (const [url, interval] of this.monitors.entries()) {
            clearInterval(interval);
            this.logInfo(`Stopped monitoring ${url}`);
        }
        this.monitors.clear();

        // Clear all reminders
        for (const timeout of this.reminders.values()) {
            clearTimeout(timeout);
        }
        this.reminders.clear();
    }

    // 16. Currency Converter (Simple static/ratio for demo or small API)
    /**
     * Gets the exchange rate between two currencies.
     * Uses a free API for demonstration.
     * @param from Source currency code (e.g. USD)
     * @param to Target currency code (e.g. EUR)
     */
    async getExchangeRate(from: string, to: string) {
        try {
            // Using a demo free API
            const res = await fetch(`${EXCHANGE_RATE_API_BASE}/${from.toUpperCase()}`);
            const data = await res.json() as ExchangeRateResponse;
            const rate = data.rates[to.toUpperCase()];
            // Standardized: return { rate } in data
            return rate ? { success: true, data: { rate } } : { success: false, error: 'Rate not found' };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            this.logError(`Failed to get exchange rate from ${from} to ${to}`, e);
            return { success: false, error: message };
        }
    }

    // 19. Uptime Monitor (Register a ping check)
    // 31. Uptime Monitor
    /**
     * Starts monitoring a URL for uptime checks.
     * @param url The URL to monitor.
     * @param intervalSeconds Interval in seconds (default 60).
     */
    startMonitor(url: string, intervalSeconds: number = 60) {
        const existing = this.monitors.get(url);
        if (existing) {
            clearInterval(existing);
        }

        const interval = intervalSeconds * 1000;
        this.logInfo(`Monitoring ${url} every ${intervalSeconds}s`);
        const timer = setInterval(async () => {
            try {
                await fetch(url, { method: 'HEAD', mode: 'no-cors' });
                this.logInfo(`${url} is UP`);
            } catch (e) {
                this.logError(`${url} is DOWN!`, e);
            }
        }, interval);

        this.monitors.set(url, timer);
        return { success: true, message: `Started monitoring ${url}` };
    }

    // 29. Smart Reminders
    private reminders: Map<string, NodeJS.Timeout> = new Map();
    /**
     * Schedules a one-time callback reminder.
     * @param text The text context for the reminder (passed back to callback).
     * @param delayMs Delay in milliseconds.
     * @param onTrigger Callback function to trigger.
     */
    scheduleReminder(text: string, delayMs: number, onTrigger: (msg: string) => void) {
        const id = randomBytes(4).toString('hex');
        const timeout = setTimeout(() => {
            onTrigger(text);
            this.reminders.delete(id);
        }, delayMs);
        this.reminders.set(id, timeout);
        return { success: true, data: { id }, message: `Reminder set for ${new Date(Date.now() + delayMs).toLocaleTimeString()}` };
    }

    /**
     * Cancels a scheduled reminder by ID.
     * @param id The reminder ID to cancel.
     */
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
    /**
     * Toggles 'Ghost Mode' (Do Not Disturb simulation).
     * @param enabled True to enable, false to disable.
     */
    toggleGhostMode(enabled: boolean) {
        if (enabled) {
            return { success: true, message: 'Ghost Mode (DND) enabled. Notifications silenced.' };
        } else {
            return { success: true, message: 'Ghost Mode disabled.' };
        }
    }

    // 35. VirusTotal Integration
    /**
     * Checks a file hash against VirusTotal API.
     * @param hash The file hash (MD5, SHA-1, or SHA-256).
     * @param apiKey VirusTotal API Key.
     */
    async checkVirusTotal(hash: string, apiKey?: string) {
        if (!apiKey) {
            return { success: false, error: 'VirusTotal API key required in arguments or settings' };
        }
        try {
            const response = await fetch(`https://www.virustotal.com/api/v3/files/${hash}`, {
                headers: { 'x-apikey': apiKey }
            });
            const data = await response.json();
            return { success: true, data };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            this.logError(`VirusTotal check failed for hash ${hash}`, e);
            return { success: false, error: message };
        }
    }

    // 36. Shodan Link
    /**
     * Looks up an IP address using Shodan.
     * @param ip IP address to lookup.
     * @param apiKey Shodan API Key.
     */
    async lookupShodan(ip: string, apiKey?: string) {
        if (!apiKey) {
            return { success: false, error: 'Shodan API key required' };
        }
        try {
            const response = await fetch(`https://api.shodan.io/shodan/host/${ip}?key=${apiKey}`);
            const data = await response.json();
            return { success: true, data };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            this.logError(`Shodan lookup failed for IP ${ip}`, e);
            return { success: false, error: message };
        }
    }

    // 37. Plugin System (Simplified)
    async loadPlugin() {
        return { success: false, error: 'Plugin loading via eval is disabled for security reasons.' };
    }

    // 39. Long-term Memory
    /**
     * Stores a key-value memory pair with encryption.
     * @param key Key string.
     * @param value Value string.
     */
    async storeMemory(key: string, value: string) {
        try {
            // Encrypt the value before storing
            const encryptedValue = this.security.encryptSync(value);
            await this.db.storeMemory(key, encryptedValue);
            return { success: true, message: `Memory stored for "${key}" (encrypted)` };
        } catch (error) {
            this.logError(`Failed to store encrypted memory for "${key}"`, error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    /**
     * Recalls a stored memory by key and decrypts it.
     * @param key Key string.
     */
    async recallMemory(key: string) {
        try {
            const memory = await this.db.recallMemory(key);
            if (!memory?.content) {
                return { success: true, data: null };
            }

            // Decrypt the content before returning
            const decryptedValue = this.security.decryptSync(memory.content);
            return { success: true, data: decryptedValue };
        } catch (error) {
            this.logError(`Failed to recall/decrypt memory for "${key}"`, error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    // 40. Local RAG (Vector-based)
    // 40. Local RAG (Deprecated)
    async indexDocument() {
        return { success: false, error: 'Deprecated. Use CodeIntelligenceService for indexing.' };
    }

    async searchDocuments() {
        return { success: false, error: 'Deprecated. Use ContextRetrievalService for search.' };
    }

    // 41. Codebase Scanner (Deprecated)
    async scanCodebase() {
        return { success: false, error: 'Deprecated. Use CodeIntelligenceService for scanning.' };
    }
}
