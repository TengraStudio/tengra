import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { DatabaseService, LinkedAccount } from '@main/services/data/database.service';
import { SecurityService } from '@main/services/security/security.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JsonObject } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { v4 as uuidv4 } from 'uuid';

/**
 * Token data received from OAuth flows or browser session extraction.
 */
export interface TokenData {
    accessToken?: string
    refreshToken?: string
    sessionToken?: string
    email?: string
    displayName?: string
    avatarUrl?: string
    expiresAt?: number
    scope?: string
    metadata?: JsonObject
}

/**
 * Public representation of a linked account (without encrypted tokens).
 */
export interface LinkedAccountInfo {
    id: string
    provider: string
    email?: string
    displayName?: string
    avatarUrl?: string
    isActive: boolean
    createdAt: number
}

/**
 * AuthService - Simplified multi-account authentication service.
 * 
 * Design principles:
 * - Database-only storage (no file-based tokens)
 * - Provider-centric: each provider can have multiple linked accounts
 * - Active account per provider: user selects which account to use
 */
export class AuthService extends BaseService {
    constructor(
        private databaseService: DatabaseService,
        private securityService: SecurityService,
        private eventBus: EventBusService,
        private dataService: DataService
    ) {
        super('AuthService');
    }

    override async initialize(): Promise<void> {
        await this.databaseService.initialize();
        appLogger.info('AuthService', 'Initialized with new multi-account system');

        // Migrate legacy files to database if any
        await this.migrateLegacyFiles();

        // Proactively migrate all tokens in DB to new encryption format
        await this.migrateExistingTokens();
    }

    async cleanup(): Promise<void> {
        appLogger.info('AuthService', 'Cleaning up authentication service...');

        // Clear any cached sensitive data
        // Note: Encrypted tokens in database are preserved

        appLogger.info('AuthService', 'Authentication service cleanup complete');
    }

    /**
     * Scans for legacy authentication files and migrates them to the database.
     */
    private async migrateLegacyFiles(): Promise<void> {
        try {
            const authDir = this.dataService.getPath('auth');
            if (!fs.existsSync(authDir)) { return; }

            const files = await fs.promises.readdir(authDir);
            let migrateCount = 0;

            for (const file of files) {
                const filePath = path.join(authDir, file);

                // Case 1: Legacy proxy-auth-token.enc
                if (file === 'proxy-auth-token.enc') {
                    await this.migrateEncryptedFile(filePath);
                    migrateCount++;
                    continue;
                }

                // Case 2: Legacy *.json files
                if (file.endsWith('.json') && file !== 'settings.json') {
                    await this.migrateJsonFile(filePath);
                    migrateCount++;
                    continue;
                }
            }

            if (migrateCount > 0) {
                appLogger.info('AuthService', `Legacy auth migration complete: Imported ${migrateCount} files.`);
            }
        } catch (error) {
            appLogger.error('AuthService', `Legacy migration failed: ${getErrorMessage(error)}`);
        }
    }

    private async migrateEncryptedFile(filePath: string): Promise<void> {
        try {
            const encrypted = await fs.promises.readFile(filePath, 'utf8');
            const token = this.decrypt(encrypted);

            if (token) {
                await this.linkAccount('proxy_key', { accessToken: token });
                appLogger.info('AuthService', 'Migrated proxy-auth-token.enc to database.');
            }

            await fs.promises.unlink(filePath);
        } catch (error) {
            appLogger.error('AuthService', `Failed to migrate encrypted file ${filePath}: ${getErrorMessage(error)}`);
        }
    }

    private async migrateJsonFile(filePath: string): Promise<void> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const data = JSON.parse(content) as JsonObject;

            const provider = (data.type as string) || (data.provider as string) || 'unknown';
            const tokenData = this.mapJsonToTokenData(data);

            if (tokenData.accessToken || tokenData.sessionToken) {
                await this.linkAccount(provider, tokenData);
                appLogger.info('AuthService', `Migrated legacy JSON file ${path.basename(filePath)} to database.`);
            }

            await fs.promises.unlink(filePath);
        } catch (error) {
            appLogger.error('AuthService', `Failed to migrate JSON file ${filePath}: ${getErrorMessage(error)}`);
        }
    }

    private mapJsonToTokenData(data: JsonObject): TokenData {
        return {
            accessToken: (data.access_token ?? data.accessToken) as string | undefined,
            refreshToken: (data.refresh_token ?? data.refreshToken) as string | undefined,
            sessionToken: (data.session_token ?? data.sessionToken) as string | undefined,
            expiresAt: (data.expires_at ?? data.expiresAt) as number | undefined,
            email: (data.email) as string | undefined,
            displayName: (data.label ?? data.displayName) as string | undefined,
            metadata: data.metadata as JsonObject | undefined
        };
    }

    /**
     * Proactively migrates all tokens in the database to the new secure encryption format.
     */
    private async migrateExistingTokens(): Promise<void> {
        try {
            const accounts = await this.databaseService.getLinkedAccounts();
            let migratedCount = 0;

            for (const account of accounts) {
                await this.checkAndUpgradeEncryption(account);
                migratedCount++;
            }

            if (migratedCount > 0) {
                appLogger.info('AuthService', `Proactive migration complete: Upgraded ${migratedCount} accounts to orbit:v1 format.`);
            }
        } catch (error) {
            appLogger.error('AuthService', `Proactive migration failed: ${getErrorMessage(error)}`);
        }
    }

    // --- Provider Methods ---

    /**
     * Get all linked accounts for a provider.
     */
    async getAccountsByProvider(provider: string): Promise<LinkedAccountInfo[]> {
        const normalized = this.normalizeProvider(provider);
        const accounts = await this.databaseService.getLinkedAccounts(normalized);
        return accounts.map(a => this.toPublicAccount(a));
    }

    /**
     * Get the active (selected) account for a provider.
     */
    async getActiveAccount(provider: string): Promise<LinkedAccountInfo | null> {
        const normalized = this.normalizeProvider(provider);
        const account = await this.databaseService.getActiveLinkedAccount(normalized);
        if (!account) { return null; }

        if (this.isExpired(account)) {
            appLogger.info('AuthService', `Account expired for ${normalized}: ${account.id}`);
            return null;
        }

        return this.toPublicAccount(account);
    }

    /**
     * Get the active account's token for a provider.
     */
    /**
     * Get the active account's token for a provider.
     */
    async getActiveToken(provider: string): Promise<string | undefined> {
        const normalized = this.normalizeProvider(provider);
        const account = await this.databaseService.getActiveLinkedAccount(normalized);
        if (!account) { return undefined; }

        if (this.isExpired(account)) {
            appLogger.info('AuthService', `Token expired for ${normalized}: ${account.id}`);
            return undefined;
        }

        return this.decrypt(account.accessToken) ??
            this.decrypt(account.sessionToken) ??
            this.decrypt(account.refreshToken);
    }

    /**
     * Get all accounts for a provider with decrypted tokens.
     */
    async getAccountsByProviderFull(provider: string): Promise<LinkedAccount[]> {
        const normalized = this.normalizeProvider(provider);
        const accounts = await this.databaseService.getLinkedAccounts(normalized);
        const fullAccounts: LinkedAccount[] = [];

        for (const a of accounts) {
            fullAccounts.push({
                ...a,
                accessToken: this.decrypt(a.accessToken),
                refreshToken: this.decrypt(a.refreshToken),
                sessionToken: this.decrypt(a.sessionToken)
            });
            // Background upgrade check
            void this.checkAndUpgradeEncryption(a);
        }
        return fullAccounts;
    }

    /**
     * Get the full active account with decrypted tokens.
     */
    async getActiveAccountFull(provider: string): Promise<LinkedAccount | null> {
        const normalized = this.normalizeProvider(provider);
        const account = await this.databaseService.getActiveLinkedAccount(normalized);
        if (!account) { return null; }

        if (this.isExpired(account)) {
            appLogger.info('AuthService', `Account expired for ${normalized}: ${account.id}`);
            return null;
        }

        const decrypted = {
            ...account,
            accessToken: this.decrypt(account.accessToken),
            refreshToken: this.decrypt(account.refreshToken),
            sessionToken: this.decrypt(account.sessionToken)
        };

        // Auto-upgrade encryption if needed
        void this.checkAndUpgradeEncryption(account);

        return decrypted;
    }

    /**
     * Set which account should be active for a provider.
     */
    async setActiveAccount(provider: string, accountId: string): Promise<void> {
        const normalized = this.normalizeProvider(provider);
        await this.databaseService.setActiveLinkedAccount(normalized, accountId);
        appLogger.info('AuthService', `Set active account for ${normalized}: ${accountId}`);
    }

    // --- Account Linking ---

    /**
     * Link a new account for a provider.
     */
    async linkAccount(provider: string, tokenData: TokenData): Promise<LinkedAccountInfo> {
        const normalized = this.normalizeProvider(provider);
        const now = Date.now();
        const email = tokenData.email ?? (tokenData.metadata?.email as string | undefined);

        const existing = await this.findExistingAccount(normalized, email);
        const account = this.createNewAccountObject(normalized, tokenData, existing, now, email);

        await this.ensureActivation(normalized, account, !!existing);

        await this.databaseService.saveLinkedAccount(account);
        this.emitLinkEvents(normalized, account, tokenData);

        return this.toPublicAccount(account);
    }

    private async findExistingAccount(provider: string, email?: string): Promise<LinkedAccount | undefined> {
        let existing = await this.findAccountByEmail(provider, email);
        if (!existing && !email) {
            const accounts = await this.databaseService.getLinkedAccounts(provider);
            if (accounts.length > 0) {
                existing = accounts[0];
            }
        }
        return existing;
    }

    private createNewAccountObject(
        provider: string,
        tokenData: TokenData,
        existing: LinkedAccount | undefined,
        now: number,
        email?: string
    ): LinkedAccount {
        const metadata = tokenData.metadata as JsonObject | undefined;
        return {
            id: existing?.id ?? uuidv4(),
            provider,
            email,
            displayName: tokenData.displayName ?? (metadata?.displayName as string | undefined),
            avatarUrl: tokenData.avatarUrl ?? (metadata?.avatarUrl as string | undefined),
            accessToken: this.encryptIfPresent(tokenData.accessToken),
            refreshToken: this.encryptIfPresent(tokenData.refreshToken),
            sessionToken: this.encryptIfPresent(tokenData.sessionToken),
            expiresAt: tokenData.expiresAt,
            scope: tokenData.scope,
            isActive: false,
            metadata: tokenData.metadata,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now
        };
    }

    private encryptIfPresent(token?: string): string | undefined {
        return token ? this.encrypt(token) : undefined;
    }

    private async ensureActivation(provider: string, account: LinkedAccount, hadExisting: boolean): Promise<void> {
        const existingAccounts = await this.databaseService.getLinkedAccounts(provider);
        if (existingAccounts.length === 0 || (existingAccounts.length === 1 && hadExisting)) {
            account.isActive = true;
        }
    }

    private emitLinkEvents(provider: string, account: LinkedAccount, tokenData: TokenData): void {
        appLogger.info('AuthService', `Linked account for ${provider}: ${tokenData.email ?? account.id}`);
        this.eventBus.emit('account:linked', { accountId: account.id, provider });
        this.eventBus.emit('account:updated', { accountId: account.id, provider });
    }

    /**
     * Unlink (remove) a specific account.
     */
    async unlinkAccount(accountId: string): Promise<void> {
        // Get the account first to check if it's active
        const accounts = await this.databaseService.getLinkedAccounts();
        const account = accounts.find(a => a.id === accountId);

        if (!account) {
            appLogger.warn('AuthService', `Account not found for unlinking: ${accountId}`);
            return;
        }

        await this.databaseService.deleteLinkedAccount(accountId);
        appLogger.info('AuthService', `Unlinked account: ${accountId}`);

        // Notify token service to stop refreshing this account
        this.eventBus.emit('account:unlinked', { accountId, provider: account.provider });

        // If this was the active account, make another one active
        if (account.isActive) {
            const remainingAccounts = await this.databaseService.getLinkedAccounts(account.provider);
            if (remainingAccounts.length > 0 && remainingAccounts[0]) {
                await this.databaseService.setActiveLinkedAccount(account.provider, remainingAccounts[0].id);
                appLogger.info('AuthService', `Auto-activated next account for ${account.provider}: ${remainingAccounts[0].id}`);
            }
        }
    }

    /**
     * Unlink all accounts for a provider.
     */
    async unlinkAllForProvider(provider: string): Promise<void> {
        const normalized = this.normalizeProvider(provider);
        const accounts = await this.databaseService.getLinkedAccounts(normalized);

        for (const account of accounts) {
            await this.databaseService.deleteLinkedAccount(account.id);
            // Notify token service to stop refreshing this account
            this.eventBus.emit('account:unlinked', { accountId: account.id, provider: account.provider });
        }
        appLogger.info('AuthService', `Unlinked all accounts for ${normalized}`);
    }

    /**
     * Update an existing linked account token.
     */
    async updateToken(accountId: string, tokenData: Partial<TokenData>): Promise<void> {
        const accounts = await this.databaseService.getLinkedAccounts();
        const account = accounts.find(a => a.id === accountId);
        if (!account) { return; }

        const updatedAccount: LinkedAccount = {
            ...account,
            updatedAt: Date.now()
        };

        if (tokenData.accessToken) { updatedAccount.accessToken = this.encrypt(tokenData.accessToken); }
        if (tokenData.refreshToken) { updatedAccount.refreshToken = this.encrypt(tokenData.refreshToken); }
        if (tokenData.sessionToken) { updatedAccount.sessionToken = this.encrypt(tokenData.sessionToken); }
        if (tokenData.expiresAt) { updatedAccount.expiresAt = tokenData.expiresAt; }
        if (tokenData.email) { updatedAccount.email = tokenData.email; }
        if (tokenData.displayName) { updatedAccount.displayName = tokenData.displayName; }
        if (tokenData.avatarUrl) { updatedAccount.avatarUrl = tokenData.avatarUrl; }
        if (tokenData.metadata) { updatedAccount.metadata = { ...account.metadata, ...tokenData.metadata }; }

        await this.databaseService.saveLinkedAccount(updatedAccount);
        appLogger.info('AuthService', `Updated token and profile for account: ${accountId}`);
        this.eventBus.emit('account:updated', { accountId: account.id, provider: account.provider });
    }

    /**
     * Public helper to decrypt a value (used by TokenService).
     */
    /**
     * Check if a specific account exists in the database.
     */
    async accountExists(accountId: string): Promise<boolean> {
        const accounts = await this.databaseService.getLinkedAccounts();
        return accounts.some(a => a.id === accountId);
    }

    /**
     * Public helper to decrypt a value (used by TokenService).
     */
    decryptToken(encryptedValue: string): string | undefined {
        return this.decrypt(encryptedValue);
    }



    // --- Query Methods ---

    /**
     * Get all linked accounts across all providers.
     */
    async getAllAccounts(): Promise<LinkedAccountInfo[]> {
        const accounts = await this.databaseService.getLinkedAccounts();
        return accounts.map(a => this.toPublicAccount(a));
    }

    /**
     * Check if a provider has any linked accounts.
     */
    async hasLinkedAccount(provider: string): Promise<boolean> {
        const normalized = this.normalizeProvider(provider);
        const accounts = await this.databaseService.getLinkedAccounts(normalized);
        return accounts.length > 0;
    }

    /**
     * Get all accounts with decrypted tokens (for internal use).
     */
    async getAllAccountsFull(): Promise<LinkedAccount[]> {
        const accounts = await this.databaseService.getLinkedAccounts();
        const fullAccounts: LinkedAccount[] = [];

        for (const a of accounts) {
            fullAccounts.push({
                ...a,
                accessToken: this.decrypt(a.accessToken),
                refreshToken: this.decrypt(a.refreshToken),
                sessionToken: this.decrypt(a.sessionToken)
            });
            // Background upgrade check
            void this.checkAndUpgradeEncryption(a);
        }
        return fullAccounts;
    }

    private async checkAndUpgradeEncryption(account: LinkedAccount): Promise<void> {
        let needsUpgrade = false;
        const updated: Partial<LinkedAccount> = {};

        const props: Array<keyof LinkedAccount> = ['accessToken', 'refreshToken', 'sessionToken'];
        for (const key of props) {
            const val = account[key];
            if (typeof val === 'string' && val.length > 0 && !val.startsWith('orbit:v1:')) {
                const decryptedValue = this.decrypt(val);
                if (decryptedValue) {
                    updated[key as 'accessToken' | 'refreshToken' | 'sessionToken'] = this.encrypt(decryptedValue);
                    needsUpgrade = true;
                }
            }
        }

        if (needsUpgrade) {
            appLogger.info('AuthService', `Upgrading encryption format for account ${account.id} (${account.provider})`);
            await this.databaseService.saveLinkedAccount({ ...account, ...updated });
        }
    }


    // --- Helper Methods ---

    private async findAccountByEmail(provider: string, email?: string): Promise<LinkedAccount | undefined> {
        const accounts = await this.databaseService.getLinkedAccounts(provider);
        return accounts.find(a => a.email === email);
    }

    private toPublicAccount(account: LinkedAccount): LinkedAccountInfo {
        return {
            id: account.id,
            provider: account.provider,
            email: account.email,
            displayName: account.displayName,
            avatarUrl: account.avatarUrl,
            isActive: account.isActive,
            createdAt: account.createdAt
        };
    }

    private encrypt(text: string | undefined): string | undefined {
        if (!text) { return undefined; }
        return this.securityService.encryptSync(text);
    }

    private decrypt(text: string | undefined): string | undefined {
        if (!text) { return undefined; }
        return this.securityService.decryptSync(text) ?? undefined;
    }

    private isExpired(account: LinkedAccount): boolean {
        if (!account.expiresAt) { return false; }
        // Add 5 minute buffer to consider it expired a bit early (safety margin)
        return Date.now() > (account.expiresAt - 300000);
    }

    private normalizeProvider(provider: string): string {
        let p = provider.toLowerCase();

        // Strip emails (e.g. claude-user@gmail.com -> claude)
        if (p.includes('@')) {
            const parts = p.split('-');
            p = parts[0] ?? p;
        }

        // Strip common suffixes
        p = p.replace(/(_token|_key|_auth)$/, '');

        // Canonical mappings
        const mappings: Record<string, string> = {
            'proxy': 'proxy_key',
            'proxy_key': 'proxy_key',
            'github': 'github',
            'github_token': 'github',
            'copilot': 'copilot',
            'copilot_token': 'copilot',
            'antigravity': 'antigravity',
            'antigravity_token': 'antigravity',
            'anthropic': 'claude',
            'anthropic_key': 'claude',
            'claude': 'claude',
            'openai': 'codex',
            'openai_key': 'codex',
            'codex': 'codex',
            'gemini': 'gemini',
            'gemini_key': 'gemini'
        };

        return mappings[p] ?? p;
    }
}
