
import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { AppSettings } from '@shared/types/settings';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { app } from 'electron';

const DEFAULT_SETTINGS: AppSettings = {
    ollama: {
        url: 'http://127.0.0.1:11434',
        numCtx: 16384,
        orchestrationPolicy: 'auto'
    },
    embeddings: {
        provider: 'ollama',
        model: 'all-minilm'
    },
    autoUpdate: {
        enabled: true,
        checkOnStartup: true,
        downloadAutomatically: true,
        notifyOnly: false
    },
    activeAccountId: 'default',
    general: {
        language: 'en',
        theme: 'graphite',
        resolution: '1280x800',
        fontSize: 14,
        onboardingCompleted: false,
        defaultModel: 'gpt-4o',
        lastModel: '',
        lastProvider: '',
        responseStyle: 'balanced',
        responseTone: 'neutral',
        responseFormat: 'auto',
        customInstructions: '',
        contextMessageLimit: 50,
        agentMode: 'adaptive',
        agentSoftDeadlineMs: 4000,
        agentHardDeadlineMs: 25000,
        agentRequireLocalForActions: true,
        agentAllowLateSuggestions: true,
        hiddenModels: []
    },
    github: {
        username: '',
        token: ''
    },
    openai: {
        apiKey: '',
        model: 'gpt-4o'
    },
    anthropic: {
        apiKey: '',
        model: 'claude-3-opus-20240229'
    },

    groq: {
        apiKey: '',
        model: 'llama3-70b-8192'
    },
    antigravity: {
        connected: false
    },
    copilot: {
        connected: false
    },
    proxy: {
        enabled: false,
        url: 'http://localhost:8317/v1',
        key: 'proxypal-local'
    },
    mcpDisabledServers: [],
    mcpUserServers: [],
    mcpSecurityAllowedHosts: [],
    mcpReviewPolicy: 'elevated',
    mcpAutoExecuteSafe: true,
    window: {
        width: 1280,
        height: 800,
        x: 0,
        y: 0,
        startOnStartup: true,
        workAtBackground: true
    }
};

import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { LinkedAccount } from '@main/services/data/database.service';
import { AuthService } from '@main/services/security/auth.service';

export class SettingsService extends BaseService {
    private settingsPath: string;
    private settings: AppSettings;
    private saveInProgress: boolean = false;
    private pendingSave: Partial<AppSettings> | null = null;
    private initialized: boolean = false;

    constructor(
        dataService?: DataService,
        private authService?: AuthService
    ) {
        super('SettingsService');

        if (dataService) {
            this.settingsPath = path.join(dataService.getPath('config'), 'settings.json');
        } else {
            this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
        }

        this.settings = { ...DEFAULT_SETTINGS };
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }
        this.settings = await this.loadSettings();
        this.initialized = true;
        appLogger.info('SettingsService', 'Initialized successfully');
    }

    async cleanup(): Promise<void> {
        if (this.saveInProgress) {
            appLogger.info('SettingsService', 'Waiting for pending save to complete before cleanup...');
            while (this.saveInProgress) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        if (this.pendingSave) {
            await this.saveSettings(this.pendingSave);
        }

        appLogger.info('SettingsService', 'Settings service cleanup complete');
    }

    private async loadSettings(): Promise<AppSettings> {
        try {
            await fs.promises.access(this.settingsPath);
        } catch {
            return this.initializeDefaults();
        }

        let loaded: Partial<AppSettings> = {};
        try {
            const data = await fs.promises.readFile(this.settingsPath, 'utf8');

            if (!data.trim()) {
                loaded = {};
            } else {
                loaded = await this.parseAndRecoverSettings(data);
            }

            const loadedRecord = loaded as Record<string, unknown>;
            if (loadedRecord.userAvatar) { delete loadedRecord.userAvatar; }
            if (loadedRecord.aiAvatar) { delete loadedRecord.aiAvatar; }

        } catch (error) {
            appLogger.error('SettingsService', `Failed to read/parse settings: ${getErrorMessage(error as Error)}`);
            loaded = {};
        }

        return this.mergeWithDefaults(loaded);
    }

    private async parseAndRecoverSettings(data: string): Promise<Partial<AppSettings>> {
        try {
            return safeJsonParse<Partial<AppSettings>>(data, {});
        } catch {
            appLogger.warn('SettingsService', 'JSON.parse failed, attempting recovery...');

            const recovered = this.attemptJsonRecovery(data);
            if (recovered) {
                appLogger.info('SettingsService', 'JSON recovery successful');
                if (recovered.wasModified) {
                    await this.backupCorruptedSettings(data, 'recovered', recovered.data);
                }
                return recovered.data;
            } else {
                appLogger.error('SettingsService', 'JSON recovery failed, using defaults');
                await this.backupCorruptedSettings(data, 'corrupted');
                return {};
            }
        }
    }

    private async backupCorruptedSettings(originalData: string, type: 'recovered' | 'corrupted', recoveredData?: Partial<AppSettings>) {
        try {
            const backupPath = `${this.settingsPath}.${type}.${Date.now()}`;
            await fs.promises.writeFile(backupPath, originalData, 'utf8');
            appLogger.info('SettingsService', `Backed up original/corrupted file to: ${backupPath}`);

            if (recoveredData) {
                await fs.promises.writeFile(this.settingsPath, JSON.stringify(recoveredData, null, 2), 'utf8');
            }
        } catch (e) {
            appLogger.warn('SettingsService', `Failed to backup ${type} settings: ${getErrorMessage(e as Error)}`);
        }
    }

    private async initializeDefaults(): Promise<AppSettings> {
        return this.mergeWithDefaults({});
    }

    private async mergeWithDefaults(loaded: Partial<AppSettings>): Promise<AppSettings> {
        let authAccounts: LinkedAccount[] = [];
        if (this.authService) {
            authAccounts = await this.authService.getAllAccountsFull();
        }

        const res: AppSettings = {
            ...DEFAULT_SETTINGS,
            ...loaded,
            ollama: { ...DEFAULT_SETTINGS.ollama, ...(loaded.ollama ?? {}) },
            autoUpdate: this.mergeAutoUpdate(loaded.autoUpdate),
            general: { ...DEFAULT_SETTINGS.general, ...(loaded.general ?? {}) },
            github: this.mergeProvider(authAccounts, 'github', loaded.github),
            openai: this.mergeProvider(authAccounts, 'openai', loaded.openai, 'apiKey'),
            anthropic: this.mergeProvider(authAccounts, 'anthropic', loaded.anthropic, 'apiKey'),
            antigravity: this.mergeProvider(authAccounts, 'antigravity', loaded.antigravity),
            copilot: this.mergeCopilot(authAccounts, loaded.copilot),
            groq: this.mergeProvider(authAccounts, 'groq', loaded.groq, 'apiKey'),
            proxy: this.mergeProxy(authAccounts, loaded.proxy),
            window: loaded.window ?? DEFAULT_SETTINGS.window
        };

        this.migrateDeprecatedSettings(res);
        return res;
    }

    private mergeAutoUpdate(loaded?: Partial<AppSettings['autoUpdate']>): AppSettings['autoUpdate'] {
        const def = DEFAULT_SETTINGS.autoUpdate ?? {
            enabled: true,
            checkOnStartup: true,
            downloadAutomatically: true,
            notifyOnly: false
        };
        return {
            enabled: loaded?.enabled ?? def.enabled,
            checkOnStartup: loaded?.checkOnStartup ?? def.checkOnStartup,
            downloadAutomatically: loaded?.downloadAutomatically ?? def.downloadAutomatically,
            notifyOnly: loaded?.notifyOnly ?? def.notifyOnly
        };
    }

    private mergeProvider<T extends keyof AppSettings>(
        authAccounts: LinkedAccount[],
        provider: T,
        loaded?: Partial<AppSettings[T]>,
        keyField: string = 'token'
    ): AppSettings[T] {
        const def = (DEFAULT_SETTINGS[provider] as Record<string, unknown>) ?? {};
        const loadedObj = (loaded ?? {}) as Record<string, unknown>;
        const tokenVal = loadedObj[keyField] as string | undefined;
        const token = this.findTokenInAuth(authAccounts, String(provider)) || (tokenVal ?? '');
        return {
            ...def,
            ...loadedObj,
            [keyField]: token
        } as AppSettings[T];
    }

    private mergeCopilot(authAccounts: LinkedAccount[], loaded?: Partial<AppSettings['copilot']>): AppSettings['copilot'] {
        const def = DEFAULT_SETTINGS.copilot;
        const token = this.findTokenInAuth(authAccounts, 'copilot') ||
            this.findTokenInAuth(authAccounts, 'github') ||
            (loaded?.token ?? '');

        if (!def) {
            return { connected: loaded?.connected ?? false, token };
        }
        return {
            connected: loaded?.connected ?? def.connected,
            token
        };
    }

    private mergeProxy(authAccounts: LinkedAccount[], loaded?: Partial<AppSettings['proxy']>): AppSettings['proxy'] {
        const def = DEFAULT_SETTINGS.proxy ?? {
            enabled: false,
            url: 'http://localhost:8317/v1',
            key: ''
        };
        const token = this.findTokenInAuth(authAccounts, 'proxy') || (loaded?.key ?? '');
        return {
            enabled: loaded?.enabled ?? def.enabled,
            url: loaded?.url ?? def.url,
            key: token
        };
    }

    private migrateDeprecatedSettings(settings: AppSettings): void {
        const embeddings = settings.embeddings as { provider: string; model?: string } | undefined;
        if (embeddings && (embeddings.provider === 'antigravity' || embeddings.provider === 'gemini')) {
            appLogger.info('SettingsService', 'Migrating deprecated embedding provider to Ollama');
            settings.embeddings.provider = 'ollama';
            settings.embeddings.model = 'all-minilm';
        }
    }

    private attemptJsonRecovery(data: string): { data: Partial<AppSettings>; wasModified: boolean } | null {
        const cleanData = data.replace(/^\uFEFF/, '');
        const startIndex = cleanData.indexOf('{');
        if (startIndex < 0) { return null; }

        const endIndex = this.findJsonObjectEnd(cleanData, startIndex);
        if (endIndex < 0) { return null; }

        const jsonCandidate = cleanData.substring(startIndex, endIndex + 1);
        const wasModified = endIndex < cleanData.length - 1 || startIndex > 0;

        try {
            return { data: safeJsonParse<Partial<AppSettings>>(jsonCandidate, {}), wasModified };
        } catch {
            return null;
        }
    }

    private findJsonObjectEnd(cleanData: string, startIndex: number): number {
        let depth = 0;
        let inString = false;
        let escapeNext = false;

        for (let i = startIndex; i < cleanData.length; i++) {
            const char = cleanData[i];

            // Handle escapes first
            if (escapeNext) {
                escapeNext = false;
                continue;
            }
            if (char === '\\' && inString) {
                escapeNext = true;
                continue;
            }

            // Handle strings
            if (char === '"') {
                inString = !inString;
                continue;
            }
            if (inString) { continue; }

            // Handle nesting
            if (char === '{') {
                depth++;
            } else if (char === '}') {
                depth--;
                if (depth === 0) { return i; }
            }
        }
        return -1;
    }

    getSettings(): AppSettings {
        return this.settings;
    }

    getSettingsPath(): string {
        return this.settingsPath;
    }

    async saveSettings(newSettings: Partial<AppSettings>): Promise<AppSettings> {
        if (this.saveInProgress) {
            this.pendingSave = { ...this.pendingSave, ...newSettings };
            return this.settings;
        }

        this.saveInProgress = true;
        const currentSettings = { ...this.settings };

        if (this.authService) {
            this.preserveSensitiveTokens(newSettings);
        }

        this.settings = this.deepMergeSettings(this.settings, newSettings) as AppSettings;

        if (this.authService) {
            await this.syncTokensToAuth(newSettings, currentSettings);
        }

        await this.persistSettingsToDisk();

        this.saveInProgress = false;
        this.processPendingSaves();

        return this.settings;
    }

    private async syncTokensToAuth(newSettings: Partial<AppSettings>, oldSettings: AppSettings): Promise<void> {
        if (!this.authService) {
            return;
        }

        const mappings = this.getTokenMappings(newSettings, oldSettings);
        for (const [key, val] of Object.entries(mappings)) {
            if (val) {
                await this.authService.linkAccount(key, { accessToken: val });
            }
        }
    }

    private getTokenMappings(newSettings: Partial<AppSettings>, oldSettings: AppSettings): Record<string, string | undefined> {
        const mappings: Record<string, string | undefined> = {};

        this.addCoreMappings(mappings, newSettings, oldSettings);
        this.addProviderMappings(mappings, newSettings, oldSettings);

        return mappings;
    }

    private addCoreMappings(mappings: Record<string, string | undefined>, newSettings: Partial<AppSettings>, oldSettings: AppSettings): void {
        this.checkTokenMapping(mappings, 'github_token', newSettings.github?.token, oldSettings.github?.token);
        this.checkTokenMapping(mappings, 'copilot_token', newSettings.copilot?.token, oldSettings.copilot?.token);
        this.checkTokenMapping(mappings, 'antigravity_token', newSettings.antigravity?.token, oldSettings.antigravity?.token);
    }

    private addProviderMappings(mappings: Record<string, string | undefined>, newSettings: Partial<AppSettings>, oldSettings: AppSettings): void {
        this.checkTokenMapping(mappings, 'openai_key', newSettings.openai?.apiKey, oldSettings.openai?.apiKey);
        this.checkTokenMapping(mappings, 'anthropic_key', newSettings.anthropic?.apiKey, oldSettings.anthropic?.apiKey);
        this.checkTokenMapping(mappings, 'groq_key', newSettings.groq?.apiKey, oldSettings.groq?.apiKey);
        this.checkTokenMapping(mappings, 'proxy_key', newSettings.proxy?.key, oldSettings.proxy?.key);
    }

    private checkTokenMapping(mappings: Record<string, string | undefined>, key: string, newVal: string | undefined, oldVal: string | undefined): void {
        if (newVal && newVal !== oldVal && newVal !== 'connected') {
            mappings[key] = newVal;
        }
    }

    private async persistSettingsToDisk(): Promise<void> {
        try {
            const settingsToSave = this.prepareSettingsForSaving();
            const jsonString = JSON.stringify(settingsToSave, null, 2);

            const tempPath = this.settingsPath + '.tmp';
            await fs.promises.writeFile(tempPath, jsonString, 'utf8');
            await fs.promises.rename(tempPath, this.settingsPath);
        } catch (error) {
            appLogger.error('SettingsService', `Failed to save settings: ${getErrorMessage(error as Error)}`);
        }
    }

    private prepareSettingsForSaving(): AppSettings {
        const settingsToSave = JSON.parse(JSON.stringify(this.settings));
        if (!this.authService) {
            return settingsToSave;
        }

        this.stripSecrets(settingsToSave);
        return settingsToSave;
    }

    private stripSecrets(settings: AppSettings): void {
        const { github, openai, anthropic, groq } = settings;
        if (github) { github.token = ''; }
        if (openai) { openai.apiKey = ''; }
        if (anthropic) { anthropic.apiKey = ''; }
        if (groq) { groq.apiKey = ''; }

        this.stripOtherSecrets(settings);
    }

    private stripOtherSecrets(settings: AppSettings): void {
        const antigravity = settings.antigravity as Record<string, unknown> | undefined;
        const copilot = settings.copilot as Record<string, unknown> | undefined;
        const proxy = settings.proxy as Record<string, unknown> | undefined;

        if (antigravity) {
            antigravity.token = undefined;
        }
        if (copilot) {
            copilot.token = undefined;
        }
        if (proxy && proxy.key !== 'connected') {
            proxy.key = '';
        }
    }

    private processPendingSaves(): void {
        if (this.pendingSave) {
            const pending = this.pendingSave;
            this.pendingSave = null;
            setImmediate(() => {
                void this.saveSettings(pending);
            });
        }
    }

    async reloadSettings(): Promise<AppSettings> {
        this.settings = await this.loadSettings();
        return this.settings;
    }

    private findTokenInAuth(authAccounts: LinkedAccount[], provider: string, fallbackKeys: string[] = []): string {
        const providers: Record<string, string[]> = {
            github: ['proxy-auth-token', 'proxy_auth_token', 'github_token', 'github', 'github.token'],
            copilot: ['proxy-auth-token', 'proxy_auth_token', 'copilot_token', 'copilot', 'copilot.token', 'github_token'],
            antigravity: ['antigravity_token', 'antigravity'],
            openai: ['openai_key', 'openai'],
            anthropic: ['anthropic_key', 'anthropic'],
            groq: ['groq_key', 'groq'],
            proxy: ['proxy_key', 'proxy']
        };

        const searchProviders = [provider, ...(providers[provider] ?? []), ...fallbackKeys];

        for (const p of searchProviders) {
            const acc = authAccounts.find(a => a.provider === p);
            if (acc) {
                return acc.accessToken ?? acc.sessionToken ?? '';
            }
        }

        const fuzzyAcc = authAccounts.find(a => (a.provider as string).startsWith(provider + '-'));
        if (fuzzyAcc) {
            return ((fuzzyAcc.accessToken as string) || (fuzzyAcc.sessionToken as string) || '');
        }

        return '';
    }

    private deepMergeSettings(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
        if (!source) { return target; }
        const res = { ...target };
        for (const key of Object.keys(source)) {
            if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                res[key] = { ...((target[key] as Record<string, unknown>) ?? {}), ...source[key] };
            } else {
                res[key] = source[key];
            }
        }
        return res;
    }

    private preserveSensitiveTokens(newSettings: Partial<AppSettings>): void {
        const preserveToken = (provider: keyof AppSettings, field: string = 'token') => {
            const newProv = newSettings[provider] as Record<string, unknown> | undefined;
            const oldProv = this.settings[provider] as Record<string, unknown> | undefined;
            if (newProv && oldProv && !newProv[field] && oldProv[field]) {
                newProv[field] = oldProv[field];
            }
        };

        preserveToken('github');
        preserveToken('copilot');
        preserveToken('antigravity');
        preserveToken('openai', 'apiKey');
        preserveToken('anthropic', 'apiKey');
        preserveToken('groq', 'apiKey');
        preserveToken('proxy', 'key');
    }
}
