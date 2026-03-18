import { randomBytes } from 'crypto';

import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { SecurityService } from '@main/services/security/security.service';

interface ExchangeRateResponse {
    rates: Record<string, number>;
}

// QUAL-002-2: Extract configurable API URLs
const EXCHANGE_RATE_API_BASE = 'https://open.er-api.com/v6/latest';
const UTILITY_MESSAGE_KEY = {
    RATE_NOT_FOUND: 'mainProcess.utilityService.rateNotFound',
    MONITOR_STARTED: 'mainProcess.utilityService.monitorStarted',
    REMINDER_SET: 'mainProcess.utilityService.reminderSet',
    REMINDER_CANCELLED: 'mainProcess.utilityService.reminderCancelled',
    REMINDER_NOT_FOUND: 'mainProcess.utilityService.reminderNotFound',
    GHOST_MODE_ENABLED: 'mainProcess.utilityService.ghostModeEnabled',
    GHOST_MODE_DISABLED: 'mainProcess.utilityService.ghostModeDisabled',
    VIRUSTOTAL_API_KEY_REQUIRED: 'mainProcess.utilityService.virusTotalApiKeyRequired',
    SHODAN_API_KEY_REQUIRED: 'mainProcess.utilityService.shodanApiKeyRequired',
    PLUGIN_LOADING_DISABLED: 'mainProcess.utilityService.pluginLoadingDisabled',
    MEMORY_STORED: 'mainProcess.utilityService.memoryStored',
    DEPRECATED_INDEX_DOCUMENT: 'mainProcess.utilityService.deprecatedIndexDocument',
    DEPRECATED_SEARCH_DOCUMENTS: 'mainProcess.utilityService.deprecatedSearchDocuments',
    DEPRECATED_SCAN_CODEBASE: 'mainProcess.utilityService.deprecatedScanCodebase'
} as const;
const UTILITY_MESSAGE = {
    RATE_NOT_FOUND: 'Rate not found',
    MONITOR_STARTED: 'Started monitoring {{url}}',
    REMINDER_SET: 'Reminder set for {{time}}',
    REMINDER_CANCELLED: 'Reminder cancelled',
    REMINDER_NOT_FOUND: 'Reminder not found',
    GHOST_MODE_ENABLED: 'Ghost Mode (DND) enabled. Notifications silenced.',
    GHOST_MODE_DISABLED: 'Ghost Mode disabled.',
    VIRUSTOTAL_API_KEY_REQUIRED: 'VirusTotal API key required in arguments or settings',
    SHODAN_API_KEY_REQUIRED: 'Shodan API key required',
    PLUGIN_LOADING_DISABLED: 'Plugin loading via eval is disabled for security reasons.',
    MEMORY_STORED: 'Memory stored for "{{key}}" (encrypted)',
    DEPRECATED_INDEX_DOCUMENT: 'Deprecated. Use CodeIntelligenceService for indexing.',
    DEPRECATED_SEARCH_DOCUMENTS: 'Deprecated. Use ContextRetrievalService for search.',
    DEPRECATED_SCAN_CODEBASE: 'Deprecated. Use CodeIntelligenceService for scanning.'
} as const;

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
            const data = (await res.json()) as ExchangeRateResponse;
            const rate = data.rates[to.toUpperCase()];
            // Standardized: return { rate } in data
            return rate
                ? { success: true, data: { rate } }
                : {
                    success: false,
                    error: UTILITY_MESSAGE.RATE_NOT_FOUND,
                    messageKey: UTILITY_MESSAGE_KEY.RATE_NOT_FOUND
                };
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
        const timer = setInterval(() => {
            void (async () => {
                try {
                    await fetch(url, { method: 'HEAD', mode: 'no-cors' });
                    this.logInfo(`${url} is UP`);
                } catch (e) {
                    this.logError(`${url} is DOWN!`, e);
                }
            })();
        }, interval);

        this.monitors.set(url, timer);
        return {
            success: true,
            message: UTILITY_MESSAGE.MONITOR_STARTED.replace('{{url}}', url),
            messageKey: UTILITY_MESSAGE_KEY.MONITOR_STARTED,
            messageParams: { url }
        };
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
        const reminderTime = new Date(Date.now() + delayMs).toLocaleTimeString();
        const timeout = setTimeout(() => {
            onTrigger(text);
            this.reminders.delete(id);
        }, delayMs);
        this.reminders.set(id, timeout);
        return {
            success: true,
            data: { id },
            message: UTILITY_MESSAGE.REMINDER_SET.replace('{{time}}', reminderTime),
            messageKey: UTILITY_MESSAGE_KEY.REMINDER_SET,
            messageParams: { time: reminderTime },
        };
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
            return {
                success: true,
                message: UTILITY_MESSAGE.REMINDER_CANCELLED,
                messageKey: UTILITY_MESSAGE_KEY.REMINDER_CANCELLED
            };
        }
        return {
            success: false,
            error: UTILITY_MESSAGE.REMINDER_NOT_FOUND,
            messageKey: UTILITY_MESSAGE_KEY.REMINDER_NOT_FOUND
        };
    }

    // 34. Ghost Mode (Productivity)
    /**
     * Toggles 'Ghost Mode' (Do Not Disturb simulation).
     * @param enabled True to enable, false to disable.
     */
    toggleGhostMode(enabled: boolean) {
        if (enabled) {
            return {
                success: true,
                message: UTILITY_MESSAGE.GHOST_MODE_ENABLED,
                messageKey: UTILITY_MESSAGE_KEY.GHOST_MODE_ENABLED
            };
        } else {
            return {
                success: true,
                message: UTILITY_MESSAGE.GHOST_MODE_DISABLED,
                messageKey: UTILITY_MESSAGE_KEY.GHOST_MODE_DISABLED
            };
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
            return {
                success: false,
                error: UTILITY_MESSAGE.VIRUSTOTAL_API_KEY_REQUIRED,
                messageKey: UTILITY_MESSAGE_KEY.VIRUSTOTAL_API_KEY_REQUIRED,
            };
        }
        try {
            const response = await fetch(`https://www.virustotal.com/api/v3/files/${hash}`, {
                headers: { 'x-apikey': apiKey },
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
            return {
                success: false,
                error: UTILITY_MESSAGE.SHODAN_API_KEY_REQUIRED,
                messageKey: UTILITY_MESSAGE_KEY.SHODAN_API_KEY_REQUIRED
            };
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
        return {
            success: false,
            error: UTILITY_MESSAGE.PLUGIN_LOADING_DISABLED,
            messageKey: UTILITY_MESSAGE_KEY.PLUGIN_LOADING_DISABLED,
        };
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
            return {
                success: true,
                message: UTILITY_MESSAGE.MEMORY_STORED.replace('{{key}}', key),
                messageKey: UTILITY_MESSAGE_KEY.MEMORY_STORED,
                messageParams: { key }
            };
        } catch (error) {
            this.logError(`Failed to store encrypted memory for "${key}"`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
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
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    // 40. Local RAG (Vector-based)
    // 40. Local RAG (Deprecated)
    async indexDocument() {
        return {
            success: false,
            error: UTILITY_MESSAGE.DEPRECATED_INDEX_DOCUMENT,
            messageKey: UTILITY_MESSAGE_KEY.DEPRECATED_INDEX_DOCUMENT
        };
    }

    async searchDocuments() {
        return {
            success: false,
            error: UTILITY_MESSAGE.DEPRECATED_SEARCH_DOCUMENTS,
            messageKey: UTILITY_MESSAGE_KEY.DEPRECATED_SEARCH_DOCUMENTS
        };
    }

    // 41. Codebase Scanner (Deprecated)
    async scanCodebase() {
        return {
            success: false,
            error: UTILITY_MESSAGE.DEPRECATED_SCAN_CODEBASE,
            messageKey: UTILITY_MESSAGE_KEY.DEPRECATED_SCAN_CODEBASE
        };
    }
}
