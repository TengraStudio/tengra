/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes,
    scryptSync
} from 'crypto';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DatabaseService, LinkedAccount } from '@main/services/data/database.service';
import { SecurityService } from '@main/services/security/security.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JsonObject, JsonValue } from '@shared/types/common';
import { AppErrorCode, getErrorMessage, TengraError, ValidationError } from '@shared/utils/error.util';
import { v4 as uuidv4 } from 'uuid';

/**
 * Token data received from OAuth flows or browser session extraction.
 */
export interface TokenData {
    key?: string
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
    decryptionError?: boolean
}

export interface ProviderHealthCheck {
    provider: string
    checkedAt: number
    totalAccounts: number
    activeAccountId?: string
    hasActiveToken: boolean
    hasRefreshToken: boolean
    expiringSoonCount: number
    expiredCount: number
    healthy: boolean
}

export interface ProviderAnalytics {
    provider: string
    totalAccounts: number
    activeAccounts: number
    lastUpdatedAt?: number
    oldestAccountAt?: number
    withRefreshToken: number
    withSessionToken: number
}

export interface TokenAnalytics {
    totalAccounts: number
    withAccessToken: number
    withRefreshToken: number
    withSessionToken: number
    expiringWithin30m: number
    expired: number
    revoked: number
}

export interface CredentialExportOptions {
    provider?: string
    password: string
    expiresInHours?: number
}

export interface CredentialImportResult {
    imported: number
    skipped: number
    expiresAt: number
}

interface CredentialExportAccount {
    id: string
    provider: string
    email?: string
    displayName?: string
    avatarUrl?: string
    accessToken?: string
    refreshToken?: string
    sessionToken?: string
    expiresAt?: number
    scope?: string
    isActive: boolean
    metadata?: JsonObject
    createdAt: number
    updatedAt: number
}

interface CredentialExportPayload {
    schemaVersion: 'credentials-export-v1'
    createdAt: number
    expiresAt: number
    accounts: CredentialExportAccount[]
}

interface CredentialExportPackage {
    schemaVersion: 'credentials-export-package-v1'
    createdAt: number
    expiresAt: number
    salt: string
    iv: string
    authTag: string
    checksum: string
    encryptedPayload: string
}

interface AuthSession {
    id: string
    provider: string
    accountId?: string
    createdAt: number
    lastSeenAt: number
    source?: string
}

const CREDENTIAL_EXPORT_PAYLOAD_SCHEMA_VERSION = 'credentials-export-v1';
const CREDENTIAL_EXPORT_PACKAGE_SCHEMA_VERSION = 'credentials-export-package-v1';
const EXPORT_PASSWORD_MIN_LENGTH = 12;
const DEFAULT_EXPORT_EXPIRY_HOURS = 24;
const MAX_EXPORT_EXPIRY_HOURS = 168;
const SENSITIVE_METADATA_KEYS = new Set([
    'access_token',
    'accesstoken',
    'refresh_token',
    'refreshtoken',
    'session_token',
    'sessiontoken',
    'id_token',
    'idtoken',
    'authorization',
    'code',
    'token',
    'secret',
    'key',
    'apikey',
    'api_key',
    'password',
    'passphrase',
]);
const OAUTH_PROVIDER_HINTS = new Set([
    'antigravity',
    'codex',
    'copilot',
    'github',
    'claude',
]);
const API_KEY_PROVIDER_HINTS = new Set([
    'openai',
    'anthropic',
    'gemini',
    'mistral',
    'groq',
    'together',
    'perplexity',
    'cohere',
    'xai',
    'deepseek',
    'openrouter',
    'nvidia',
    'huggingface',
]);
type CredentialKind = 'oauth' | 'api_key';

/**
 * AuthService - Simplified multi-account authentication service.
 * 
 * Design principles:
 * - Database-only storage (no file-based tokens)
 * - Provider-centric: each provider can have multiple linked accounts
 * - Active account per provider: user selects which account to use
 */
export class AuthService extends BaseService {
    private sessions = new Map<string, AuthSession>();
    private _providerSessionLimits = new Map<string, number>();
    private readonly _defaultSessionLimit = 5;
    private _sessionIdleTtlMs = 24 * 60 * 60 * 1000;
    private linkedAccountsCache: LinkedAccount[] | null = null;
    private linkedAccountsCacheInFlight: Promise<LinkedAccount[]> | null = null;
    private upgradingAccountIds = new Set<string>();

    constructor(
        private databaseService: DatabaseService,
        private securityService: SecurityService,
        private eventBus: EventBusService
    ) {
        super('AuthService');
    }

    override async initialize(): Promise<void> {
        await this.databaseService.initialize();
        appLogger.info('AuthService', 'Initialized with new multi-account system');

        // Proactively migrate all tokens in DB to new encryption format
        await this.migrateExistingTokens();
        await this.refreshLinkedAccountsCache();
        await this.scrubSensitiveMetadataFromLinkedAccounts();
        await this.cleanupMirroredOAuthAccounts();
    }

    async cleanup(): Promise<void> {
        appLogger.info('AuthService', 'Cleaning up authentication service...');

        // Clear any cached sensitive data
        // Note: Encrypted tokens in database are preserved
        this.sessions.clear();
        this.linkedAccountsCache = null;
        this.linkedAccountsCacheInFlight = null;

        appLogger.info('AuthService', 'Authentication service cleanup complete');
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
                appLogger.info('AuthService', `Proactive migration complete: Upgraded ${migratedCount} accounts to Tengra:v1 format.`);
            }
        } catch (error) {
            appLogger.error('AuthService', `Proactive migration failed: ${getErrorMessage(error)}`);
        }
    }

    private async scrubSensitiveMetadataFromLinkedAccounts(): Promise<void> {
        const accounts = await this.getAllLinkedAccountsCached();
        let changed = false;

        for (const account of accounts) {
            const sanitizedMetadata = this.sanitizeAccountMetadata(account.metadata);
            if (JSON.stringify(sanitizedMetadata ?? null) === JSON.stringify(account.metadata ?? null)) {
                continue;
            }

            await this.databaseService.saveLinkedAccount({
                ...account,
                metadata: sanitizedMetadata,
                updatedAt: Date.now()
            });
            changed = true;
        }

        if (!changed) {
            return;
        }

        await this.refreshLinkedAccountsCache();
        appLogger.info('AuthService', 'Removed sensitive token fields from linked-account metadata.');
    }

    // --- Provider Methods ---

    /**
     * Get all linked accounts for a provider.
     */
    async getAccountsByProvider(provider: string): Promise<LinkedAccountInfo[]> {
        const normalized = this.normalizeProvider(provider);
        const accounts = await this.getLinkedAccountsFresh(normalized);
        return accounts.map(a => this.toPublicAccount(a));
    }

    /**
     * Get the active (selected) account for a provider.
     */
    async getActiveAccount(provider: string): Promise<LinkedAccountInfo | null> {
        const normalized = this.normalizeProvider(provider);
        const account = await this.getActiveLinkedAccountFresh(normalized);
        if (!account) { return null; }

        if (this.isExpired(account)) {
            appLogger.debug('AuthService', `Account expired for ${normalized}: ${account.id}`);
            return null;
        }

        return this.toPublicAccount(account);
    }
 
    /**
     * Get the active account's token for a provider.
     */
    async getActiveToken(provider: string): Promise<string | undefined> {
        const normalized = this.normalizeProvider(provider);
        const account = await this.getActiveLinkedAccountCached(normalized);
        if (!account) { return undefined; }

        if (this.isExpired(account)) {
            appLogger.info('AuthService', `Token expired for ${normalized}: ${account.id}`);
            return undefined;
        }

        const token = this.decrypt(account.accessToken) ??
            this.decrypt(account.sessionToken) ??
            this.decrypt(account.refreshToken);
        if (token) {
            this.startSession(normalized, account.id, 'active-token');
        }
        return token;
    }

    /**
     * Get all accounts for a provider with decrypted tokens.
     */
    async getAccountsByProviderFull(provider: string): Promise<LinkedAccount[]> {
        const normalized = this.normalizeProvider(provider);
        const accounts = await this.getLinkedAccountsCached(normalized);
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
        const account = await this.getActiveLinkedAccountCached(normalized);
        if (!account) { return null; }

        if (this.isExpired(account)) {
            appLogger.debug('AuthService', `Account expired for ${normalized}: ${account.id}`);
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
        this.applyActiveAccountToCache(normalized, accountId);
        appLogger.info('AuthService', `Set active account for ${normalized}: ${accountId}`);
    }

    // --- Account Linking ---

    /**
     * Link a new account for a provider.
     */
    async linkAccount(provider: string, tokenData: TokenData): Promise<LinkedAccountInfo> {
        const detected = this.detectProvider(provider, tokenData);
        const normalized = this.normalizeProvider(detected);
        const credentialKind = this.resolveCredentialKind(provider, normalized, tokenData);
        const normalizedTokenData = this.normalizeTokenDataForCredentialKind(
            provider,
            tokenData,
            credentialKind
        );
        const now = Date.now();
        const email = normalizedTokenData.email ?? (normalizedTokenData.metadata?.email as string | undefined);

        const existing = credentialKind === 'api_key'
            ? await this.findExistingApiKeyAccount(normalized, normalizedTokenData.accessToken)
            : await this.findExistingAccount(normalized, email);
        const account = this.applyCredentialKindToAccount(
            this.createNewAccountObject({
                provider: normalized,
                tokenData: normalizedTokenData,
                existing,
                now,
                email
            }),
            credentialKind
        );

        await this.ensureActivation(normalized, account, !!existing);

        await this.databaseService.saveLinkedAccount(account);
        this.upsertLinkedAccountCache(account);
        this.emitLinkEvents(normalized, account, normalizedTokenData);

        return this.toPublicAccount(account);
    }

    /**
     * Link or update an account using a caller-provided ID.
     * Used by the proxy auth store to persist OAuth tokens directly to the database.
     */
    async linkAccountWithId(provider: string, accountId: string, tokenData: TokenData): Promise<LinkedAccountInfo> {
        const normalized = this.normalizeProvider(provider);
        const credentialKind = this.resolveCredentialKind(provider, normalized, tokenData);
        const normalizedTokenData = this.normalizeTokenDataForCredentialKind(
            provider,
            tokenData,
            credentialKind
        );
        const now = Date.now();
        const email = normalizedTokenData.email ?? (normalizedTokenData.metadata?.email as string | undefined);

        if (!accountId) {
            return this.linkAccount(provider, tokenData);
        }

        let existing = await this.getLinkedAccountCached(accountId);
        const existingProvider = existing?.provider ? this.normalizeProvider(existing.provider) : undefined;
        const resolvedProvider = existingProvider ?? normalized;
        if (existing?.provider && existingProvider !== normalized) {
            appLogger.warn('AuthService', `Provider mismatch for account ${accountId}: ${existing.provider} vs ${normalized}. Using canonical ${resolvedProvider}.`);
        }

        if (
            credentialKind === 'oauth'
            && !existing
            && this.shouldCoalesceSparseOAuthUpdate(resolvedProvider, normalizedTokenData)
        ) {
            const providerAccounts = await this.getLinkedAccountsCached(resolvedProvider);
            const preferred = this.selectPreferredRichOAuthAccount(resolvedProvider, providerAccounts);
            if (preferred) {
                existing = preferred;
                appLogger.warn(
                    'AuthService',
                    `Coalescing sparse ${resolvedProvider} account update for ${accountId} into existing account ${preferred.id}`
                );
            }
        }

        const account = this.applyCredentialKindToAccount(
            this.createNewAccountObject({
                provider: resolvedProvider,
                tokenData: normalizedTokenData,
                existing: existing ?? undefined,
                now,
                email,
                preferredId: accountId
            }),
            credentialKind
        );

        await this.ensureActivation(resolvedProvider, account, !!existing);
        await this.databaseService.saveLinkedAccount(account);
        this.upsertLinkedAccountCache(account);
        this.emitLinkEvents(resolvedProvider, account, normalizedTokenData);

        return this.toPublicAccount(account);
    }

    private resolveCredentialKind(
        providerHint: string | undefined,
        normalizedProvider: string,
        tokenData: TokenData
    ): CredentialKind {
        const metadata = tokenData.metadata;
        const authType = this.getMetadataString(metadata, 'auth_type', 'authType');
        const metadataType = this.getMetadataString(metadata, 'type');
        if (authType === 'api_key' || metadataType === 'api_key') {
            return 'api_key';
        }
        if (authType === 'oauth' || metadataType === 'oauth') {
            return 'oauth';
        }

        const normalizedHint = this.normalizeProviderHint(providerHint);
        if (API_KEY_PROVIDER_HINTS.has(normalizedHint)) {
            return 'api_key';
        }
        if (OAUTH_PROVIDER_HINTS.has(normalizedHint)) {
            return 'oauth';
        }

        if (tokenData.refreshToken || tokenData.sessionToken || tokenData.expiresAt) {
            return 'oauth';
        }

        if (this.supportsRichOAuthProfile(normalizedProvider)) {
            return 'oauth';
        }

        if (this.looksLikeApiKeyToken(tokenData.accessToken)) {
            return 'api_key';
        }

        return 'oauth';
    }

    private normalizeTokenDataForCredentialKind(
        providerHint: string | undefined,
        tokenData: TokenData,
        credentialKind: CredentialKind
    ): TokenData {
        const normalizedAccessToken = tokenData.accessToken?.trim() || tokenData.key?.trim();
        const metadata = this.sanitizeAccountMetadata(tokenData.metadata) ?? {};
        const providerHintValue = this.normalizeProviderHint(providerHint);
        const mergedMetadata: JsonObject = {
            ...metadata,
            auth_type: credentialKind,
            ...(providerHintValue ? { provider_hint: providerHintValue } : {})
        };
        if (credentialKind === 'api_key') {
            return {
                key: normalizedAccessToken,
                accessToken: normalizedAccessToken,
                metadata: {
                    ...mergedMetadata,
                    type: 'api_key',
                }
            };
        }

        return {
            ...tokenData,
            key: tokenData.key?.trim(),
            accessToken: normalizedAccessToken,
            refreshToken: tokenData.refreshToken?.trim(),
            sessionToken: tokenData.sessionToken?.trim(),
            metadata: {
                ...mergedMetadata,
                type: typeof mergedMetadata.type === 'string' ? mergedMetadata.type : 'oauth',
            }
        };
    }

    private applyCredentialKindToAccount(
        account: LinkedAccount,
        credentialKind: CredentialKind
    ): LinkedAccount {
        if (credentialKind !== 'api_key') {
            return account;
        }

        return {
            ...account,
            refreshToken: undefined,
            sessionToken: undefined,
            expiresAt: undefined,
            scope: undefined,
        };
    }

    private normalizeProviderHint(providerHint: string | undefined): string {
        return String(providerHint ?? '')
            .trim()
            .toLowerCase()
            .replace(/(_token|_key|_auth)$/g, '');
    }

    private getMetadataString(
        metadata: JsonObject | undefined,
        ...keys: string[]
    ): string | undefined {
        if (!metadata || typeof metadata !== 'object') {
            return undefined;
        }

        for (const key of keys) {
            const value = metadata[key];
            if (typeof value === 'string' && value.trim().length > 0) {
                return value.trim().toLowerCase();
            }
        }

        return undefined;
    }

    private async findExistingApiKeyAccount(
        provider: string,
        accessToken: string | undefined
    ): Promise<LinkedAccount | undefined> {
        const normalizedToken = accessToken?.trim();
        if (!normalizedToken) {
            return undefined;
        }

        const accounts = await this.getLinkedAccountsCached(provider);
        for (const account of accounts) {
            const decryptedToken = this.decrypt(account.accessToken)?.trim();
            if (decryptedToken && decryptedToken === normalizedToken) {
                return account;
            }
        }

        return undefined;
    }

    private async findExistingAccount(provider: string, email?: string): Promise<LinkedAccount | undefined> {
        let existing = await this.findAccountByEmail(provider, email);
        if (!existing && !email) {
            const accounts = await this.getLinkedAccountsCached(provider);
            if (accounts.length > 0) {
                existing = this.selectPreferredRichOAuthAccount(provider, accounts) ?? accounts[0];
            }
        }
        return existing;
    }

    private createNewAccountObject(params: {
        provider: string,
        tokenData: TokenData,
        existing: LinkedAccount | undefined,
        now: number,
        email?: string,
        preferredId?: string
    }): LinkedAccount {
        const { provider, tokenData, existing, now, email, preferredId } = params;
        const metadata = this.mergeAccountMetadata(existing?.metadata, tokenData.metadata);
        const metadataEmail = typeof metadata?.email === 'string' ? metadata.email : undefined;
        const metadataDisplayName = typeof metadata?.displayName === 'string'
            ? metadata.displayName
            : typeof metadata?.display_name === 'string'
                ? metadata.display_name
                : undefined;
        const metadataAvatarUrl = typeof metadata?.avatarUrl === 'string'
            ? metadata.avatarUrl
            : typeof metadata?.avatar_url === 'string'
                ? metadata.avatar_url
                : undefined;
        return {
            id: existing?.id ?? preferredId ?? uuidv4(),
            provider,
            email: email ?? metadataEmail ?? existing?.email,
            displayName: tokenData.displayName ?? metadataDisplayName ?? existing?.displayName,
            avatarUrl: tokenData.avatarUrl ?? metadataAvatarUrl ?? existing?.avatarUrl,
            accessToken: this.mergeEncryptedToken(existing?.accessToken, tokenData.accessToken),
            refreshToken: this.mergeEncryptedToken(existing?.refreshToken, tokenData.refreshToken),
            sessionToken: this.mergeEncryptedToken(existing?.sessionToken, tokenData.sessionToken),
            expiresAt: tokenData.expiresAt ?? existing?.expiresAt,
            scope: tokenData.scope ?? existing?.scope,
            isActive: existing?.isActive ?? false,
            metadata,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now
        };
    }

    private mergeEncryptedToken(existing: string | undefined, nextToken?: string): string | undefined {
        const normalized = this.normalizeOptionalToken(nextToken);
        return normalized ? this.encrypt(normalized) : existing;
    }

    private normalizeOptionalToken(token?: string): string | undefined {
        const normalized = token?.trim();
        return normalized ? normalized : undefined;
    }

    private mergeAccountMetadata(
        existing: JsonObject | undefined,
        incoming: JsonObject | undefined
    ): JsonObject | undefined {
        const sanitizedExisting = this.sanitizeAccountMetadata(existing);
        const sanitizedIncoming = this.sanitizeAccountMetadata(incoming);

        if (!sanitizedExisting && !sanitizedIncoming) {
            return undefined;
        }
        if (!sanitizedExisting) {
            return sanitizedIncoming;
        }
        if (!sanitizedIncoming) {
            return sanitizedExisting;
        }
        return {
            ...sanitizedExisting,
            ...sanitizedIncoming
        };
    }

    private sanitizeAccountMetadata(metadata: JsonObject | undefined): JsonObject | undefined {
        if (!metadata) {
            return undefined;
        }

        const sanitized = this.sanitizeMetadataValue(metadata);
        if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
            return undefined;
        }

        return sanitized;
    }

    private sanitizeMetadataValue(value: JsonValue): JsonValue | undefined {
        if (Array.isArray(value)) {
            const sanitizedArray = value
                .map(entry => this.sanitizeMetadataValue(entry))
                .filter((entry): entry is JsonValue => entry !== undefined);
            return sanitizedArray;
        }

        if (!value || typeof value !== 'object') {
            return value;
        }

        const sanitizedEntries: Array<[string, JsonValue]> = [];
        for (const [key, entry] of Object.entries(value)) {
            if (SENSITIVE_METADATA_KEYS.has(key.toLowerCase())) {
                continue;
            }

            const sanitizedEntry = this.sanitizeMetadataValue(entry as JsonValue);
            if (sanitizedEntry !== undefined) {
                sanitizedEntries.push([key, sanitizedEntry]);
            }
        }

        return Object.fromEntries(sanitizedEntries);
    }

    private async ensureActivation(provider: string, account: LinkedAccount, hadExisting: boolean): Promise<void> {
        const existingAccounts = await this.getLinkedAccountsCached(provider);
        if (existingAccounts.length === 0 || (existingAccounts.length === 1 && hadExisting)) {
            account.isActive = true;
        }
    }

    private emitLinkEvents(provider: string, account: LinkedAccount, _tokenData: TokenData): void {
        this.eventBus.emit('account:linked', { accountId: account.id, provider });
        this.eventBus.emit('account:updated', { accountId: account.id, provider });
    }

    /**
     * Unlink (remove) a specific account.
     */
    async unlinkAccount(accountId: string): Promise<void> {
        // Get the account first to check if it's active
        const accounts = await this.getAllLinkedAccountsCached();
        const account = accounts.find(a => a.id === accountId);

        if (!account) {
            appLogger.warn('AuthService', `Account not found for unlinking: ${accountId}`);
            return;
        }

        await this.databaseService.deleteLinkedAccount(accountId);
        this.removeLinkedAccountFromCache(accountId);
        appLogger.info('AuthService', `Unlinked account: ${accountId}`);

        // Notify token service to stop refreshing this account
        this.eventBus.emit('account:unlinked', { accountId, provider: account.provider });

        // If this was the active account, make another one active
        if (account.isActive) {
            const remainingAccounts = await this.getLinkedAccountsCached(account.provider);
            if (remainingAccounts.length > 0 && remainingAccounts[0]) {
                await this.databaseService.setActiveLinkedAccount(account.provider, remainingAccounts[0].id);
                this.applyActiveAccountToCache(account.provider, remainingAccounts[0].id);
                appLogger.info('AuthService', `Auto-activated next account for ${account.provider}: ${remainingAccounts[0].id}`);
            }
        }
    }

    /**
     * Unlink all accounts for a provider.
     */
    async unlinkAllForProvider(provider: string): Promise<void> {
        const normalized = this.normalizeProvider(provider);
        const accounts = await this.getLinkedAccountsCached(normalized);

        for (const account of accounts) {
            await this.databaseService.deleteLinkedAccount(account.id);
            this.removeLinkedAccountFromCache(account.id);
            // Notify token service to stop refreshing this account
            this.eventBus.emit('account:unlinked', { accountId: account.id, provider: account.provider });
        }
        appLogger.info('AuthService', `Unlinked all accounts for ${normalized}`);
    }

    /**
     * Update an existing linked account token.
     */
    async updateToken(accountId: string, tokenData: Partial<TokenData>): Promise<void> {
        const accounts = await this.getAllLinkedAccountsCached();
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
        this.upsertLinkedAccountCache(updatedAccount);
        appLogger.debug('AuthService', `Updated token and profile for account: ${accountId}`);
        this.eventBus.emit('account:updated', { accountId: account.id, provider: account.provider });
    }

    /**
     * Public helper to decrypt a value (used by TokenService).
     */
    /**
     * Check if a specific account exists in the database.
     */
    async accountExists(accountId: string): Promise<boolean> {
        const accounts = await this.getAllLinkedAccountsCached();
        return accounts.some(a => a.id === accountId);
    }

    /**
     * Public helper to decrypt a value (used by TokenService).
     */
    decryptToken(encryptedValue: string): string | undefined {
        return this.decrypt(encryptedValue);
    }

    /**
     * Creates encrypted backup payload for master key recovery.
     */
    createMasterKeyBackup(passphrase: string): string {
        const result = this.securityService.createEncryptedMasterKeyBackup(passphrase);
        if (!result.success || !result.result?.backup) {
            throw new TengraError(result.error ?? 'Failed to create master key backup', AppErrorCode.AUTH_ERROR);
        }
        return result.result.backup;
    }

    /**
     * Restores master key from encrypted backup payload.
     */
    async restoreMasterKeyBackup(backupPayload: string, passphrase: string): Promise<void> {
        const result = await this.securityService.restoreMasterKeyBackup(backupPayload, passphrase);
        if (!result.success) {
            throw new TengraError(result.error ?? 'Failed to restore master key backup', AppErrorCode.AUTH_ERROR);
        }
    }



    // --- Query Methods ---

    /**
     * Get all linked accounts across all providers.
     */
    async getAllAccounts(): Promise<LinkedAccountInfo[]> {
        const accounts = await this.getAllLinkedAccountsFresh();
        return accounts.map(a => this.toPublicAccount(a));
    }

    /**
     * Check if a provider has any linked accounts.
     */
    async hasLinkedAccount(provider: string): Promise<boolean> {
        const normalized = this.normalizeProvider(provider);
        const accounts = await this.getLinkedAccountsFresh(normalized);
        return accounts.length > 0;
    }

    /**
     * Get all accounts with decrypted tokens (for internal use).
     */
    async getAllAccountsFull(): Promise<LinkedAccount[]> {
        const accounts = await this.getAllLinkedAccountsCached();
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

    async reloadLinkedAccountsCache(): Promise<void> {
        await this.refreshLinkedAccountsCache();
        await this.cleanupMirroredOAuthAccounts();
    }

    private async cleanupMirroredOAuthAccounts(): Promise<void> {
        const accounts = await this.getAllAccountsFull();
        let changed = false;

        for (const provider of ['antigravity', 'copilot', 'codex', 'claude']) {
            const providerAccounts = accounts.filter(
                account => this.normalizeProvider(account.provider) === provider
            );
            const shadowAccounts = providerAccounts.filter(account =>
                this.isMirroredOAuthShadowAccount(account)
            );
            const richAccounts = providerAccounts.filter(
                account => !this.isMirroredOAuthShadowAccount(account)
            );

            if (shadowAccounts.length === 0 || richAccounts.length === 0) {
                continue;
            }

            const preferredActiveAccount = richAccounts.find(account => account.isActive)
                ?? [...richAccounts].sort((left, right) => right.updatedAt - left.updatedAt)[0];

            if (preferredActiveAccount && !preferredActiveAccount.isActive) {
                await this.databaseService.setActiveLinkedAccount(provider, preferredActiveAccount.id);
                this.applyActiveAccountToCache(provider, preferredActiveAccount.id);
                changed = true;
            }

            for (const shadowAccount of shadowAccounts) {
                await this.databaseService.deleteLinkedAccount(shadowAccount.id);
                this.removeLinkedAccountFromCache(shadowAccount.id);
                this.eventBus.emit('account:unlinked', {
                    accountId: shadowAccount.id,
                    provider: shadowAccount.provider
                });
                changed = true;
            }

            appLogger.info(
                'AuthService',
                `Removed ${shadowAccounts.length} mirrored ${provider} account(s) in favor of richer OAuth records`
            );
        }

        if (changed) {
            await this.refreshLinkedAccountsCache();
        }
    }

    private async getAllLinkedAccountsCached(): Promise<LinkedAccount[]> {
        if (this.linkedAccountsCache) {
            return [...this.linkedAccountsCache];
        }
        return this.refreshLinkedAccountsCache();
    }

    private async getAllLinkedAccountsFresh(): Promise<LinkedAccount[]> {
        return this.refreshLinkedAccountsCache();
    }

    private async getLinkedAccountsCached(provider?: string): Promise<LinkedAccount[]> {
        if (!provider) {
            return this.getAllLinkedAccountsCached();
        }

        const normalized = this.normalizeProvider(provider);

        if (!this.linkedAccountsCache) {
            const providerAccounts = await this.databaseService.getLinkedAccounts(normalized);
            return [...providerAccounts];
        }

        const accounts = await this.getAllLinkedAccountsCached();
        return accounts.filter(account => this.normalizeProvider(account.provider) === normalized);
    }

    private async getLinkedAccountsFresh(provider?: string): Promise<LinkedAccount[]> {
        const accounts = await this.getAllLinkedAccountsFresh();
        if (!provider) {
            return accounts;
        }
        const normalized = this.normalizeProvider(provider);
        return accounts.filter(account => this.normalizeProvider(account.provider) === normalized);
    }

    private async getLinkedAccountCached(accountId: string): Promise<LinkedAccount | null> {
        const accounts = await this.getAllLinkedAccountsCached();
        return accounts.find(account => account.id === accountId) ?? null;
    }

    private async getActiveLinkedAccountCached(provider: string): Promise<LinkedAccount | null> {
        if (!this.linkedAccountsCache) {
            const normalized = this.normalizeProvider(provider);
            const activeAccount = await this.databaseService.getActiveLinkedAccount(normalized);
            if (activeAccount) {
                return activeAccount;
            }
        }

        const accounts = await this.getLinkedAccountsCached(provider);
        return accounts.find(account => account.isActive) ?? accounts[0] ?? null;
    }

    private async getActiveLinkedAccountFresh(provider: string): Promise<LinkedAccount | null> {
        const accounts = await this.getLinkedAccountsFresh(provider);
        return accounts.find(account => account.isActive) ?? accounts[0] ?? null;
    }

    private async refreshLinkedAccountsCache(): Promise<LinkedAccount[]> {
        if (this.linkedAccountsCacheInFlight) {
            return this.linkedAccountsCacheInFlight;
        }
        this.linkedAccountsCacheInFlight = this.databaseService.getLinkedAccounts()
            .then(accounts => {
                this.linkedAccountsCache = accounts;
                return [...accounts];
            })
            .finally(() => {
                this.linkedAccountsCacheInFlight = null;
            });
        return this.linkedAccountsCacheInFlight;
    }

    private upsertLinkedAccountCache(account: LinkedAccount): void {
        const current = this.linkedAccountsCache ?? [];
        const next = current.filter(existing => existing.id !== account.id);
        next.push(account);
        this.linkedAccountsCache = next;
    }

    private removeLinkedAccountFromCache(accountId: string): void {
        if (!this.linkedAccountsCache) {
            return;
        }
        this.linkedAccountsCache = this.linkedAccountsCache.filter(account => account.id !== accountId);
    }

    private applyActiveAccountToCache(provider: string, accountId: string): void {
        if (!this.linkedAccountsCache) {
            return;
        }
        const normalized = this.normalizeProvider(provider);
        this.linkedAccountsCache = this.linkedAccountsCache.map(account => {
            if (this.normalizeProvider(account.provider) !== normalized) {
                return account;
            }
            return {
                ...account,
                isActive: account.id === accountId
            };
        });
    }

    private isMirroredOAuthShadowAccount(account: LinkedAccount): boolean {
        if (this.isApiKeyAccount(account)) {
            return false;
        }

        if (!account.accessToken) {
            return false;
        }

        if (
            account.refreshToken
            || account.sessionToken
            || account.expiresAt
            || account.email
            || account.displayName
            || account.avatarUrl
        ) {
            return false;
        }

        return !this.hasMeaningfulOAuthMetadata(account.metadata);
    }

    private isApiKeyAccount(
        account: Pick<LinkedAccount, 'accessToken' | 'refreshToken' | 'sessionToken' | 'metadata'>
    ): boolean {
        const authType = this.getMetadataString(account.metadata, 'auth_type', 'authType');
        const metadataType = this.getMetadataString(account.metadata, 'type');
        if (authType === 'oauth' || metadataType === 'oauth') {
            return false;
        }

        if (authType === 'api_key' || metadataType === 'api_key') {
            return true;
        }

        const hasOauthTokens = Boolean(account.refreshToken) || Boolean(account.sessionToken);
        if (hasOauthTokens) {
            return false;
        }

        return this.looksLikeApiKeyToken(account.accessToken);
    }

    private hasMeaningfulOAuthMetadata(metadata?: JsonObject): boolean {
        if (!metadata) {
            return false;
        }

        const meaningfulKeys = [
            'email',
            'displayName',
            'display_name',
            'avatarUrl',
            'avatar_url',
            'refreshToken',
            'refresh_token',
            'sessionToken',
            'session_token',
            'expiresAt',
            'expires_at',
        ];

        return meaningfulKeys.some(key => {
            const value = metadata[key];
            return typeof value === 'string'
                ? value.trim().length > 0
                : typeof value === 'number';
        });
    }

    private shouldCoalesceSparseOAuthUpdate(provider: string, tokenData: TokenData): boolean {
        if (!this.supportsRichOAuthProfile(provider)) {
            return false;
        }

        if (tokenData.refreshToken || tokenData.sessionToken || tokenData.expiresAt) {
            return false;
        }

        if (tokenData.email || tokenData.displayName || tokenData.avatarUrl) {
            return false;
        }

        return !this.hasMeaningfulOAuthMetadata(tokenData.metadata);
    }

    private supportsRichOAuthProfile(provider: string): boolean {
        return ['antigravity', 'copilot', 'codex', 'claude'].includes(this.normalizeProvider(provider));
    }

    private selectPreferredRichOAuthAccount(
        provider: string,
        accounts: LinkedAccount[]
    ): LinkedAccount | undefined {
        if (!this.supportsRichOAuthProfile(provider)) {
            return undefined;
        }

        const richAccounts = accounts.filter(
            account => !this.isMirroredOAuthShadowAccount(account) && !this.isApiKeyAccount(account)
        );
        if (richAccounts.length === 0) {
            return undefined;
        }

        return richAccounts.find(account => account.isActive)
            ?? [...richAccounts].sort((left, right) => right.updatedAt - left.updatedAt)[0];
    }

    detectProvider(providerHint: string | undefined, tokenData?: Partial<TokenData>): string {
        const normalizedHint = (providerHint ?? '').trim().toLowerCase();
        if (normalizedHint && normalizedHint !== 'auto' && normalizedHint !== 'unknown') {
            return normalizedHint;
        }

        const metadataProvider = typeof tokenData?.metadata?.provider === 'string'
            ? tokenData.metadata.provider.toLowerCase()
            : undefined;
        if (metadataProvider) { return metadataProvider; }

        const scope = (tokenData?.scope ?? '').toLowerCase();
        const email = (tokenData?.email ?? '').toLowerCase();
        const accessToken = tokenData?.accessToken ?? tokenData?.key ?? '';

        if (scope.includes('repo') || scope.includes('read:user') || email.endsWith('@github.com')) {
            return 'github';
        }
        if (scope.includes('anthropic') || email.includes('anthropic')) {
            return 'claude';
        }
        if (scope.includes('google') || scope.includes('cloud-platform') || email.endsWith('@gmail.com')) {
            return 'antigravity';
        }
        if (accessToken.startsWith('sk-') || accessToken.startsWith('sess-')) {
            return 'codex';
        }
        return 'unknown';
    }

    private looksLikeApiKeyToken(token?: string): boolean {
        if (!token) {
            return false;
        }

        const normalized = token.trim().toLowerCase();
        if (!normalized) {
            return false;
        }

        return normalized.startsWith('sk-')
            || normalized.startsWith('sk_')
            || normalized.startsWith('gsk_')
            || normalized.startsWith('hf_')
            || normalized.startsWith('nvapi-')
            || normalized.startsWith('aiza')
            || normalized.startsWith('pplx-')
            || normalized.startsWith('xai-');
    }

    async getProviderHealth(provider?: string): Promise<ProviderHealthCheck[]> {
        const accounts = provider
            ? await this.databaseService.getLinkedAccounts(this.normalizeProvider(provider))
            : await this.databaseService.getLinkedAccounts();
        const byProvider = new Map<string, LinkedAccount[]>();
        for (const account of accounts) {
            const p = this.normalizeProvider(account.provider);
            if (!byProvider.has(p)) { byProvider.set(p, []); }
            byProvider.get(p)?.push(account);
        }

        const now = Date.now();
        return Array.from(byProvider.entries()).map(([p, list]) => {
            const active = list.find(a => a.isActive);
            const expiredCount = list.filter(a => this.isExpired(a)).length;
            const expiringSoonCount = list.filter(a => !this.isExpired(a) && !!a.expiresAt && (a.expiresAt - now) < 30 * 60 * 1000).length;
            const hasActiveToken = !!(active && (active.accessToken || active.sessionToken));
            const hasRefreshToken = list.some(a => !!a.refreshToken);

            return {
                provider: p,
                checkedAt: now,
                totalAccounts: list.length,
                activeAccountId: active?.id,
                hasActiveToken,
                hasRefreshToken,
                expiringSoonCount,
                expiredCount,
                healthy: list.length > 0 && hasActiveToken && expiredCount < list.length
            };
        }).sort((a, b) => a.provider.localeCompare(b.provider));
    }

    async getProviderAnalytics(): Promise<ProviderAnalytics[]> {
        const accounts = await this.databaseService.getLinkedAccounts();
        const byProvider = new Map<string, LinkedAccount[]>();
        for (const account of accounts) {
            const p = this.normalizeProvider(account.provider);
            if (!byProvider.has(p)) { byProvider.set(p, []); }
            byProvider.get(p)?.push(account);
        }

        return Array.from(byProvider.entries()).map(([provider, list]) => ({
            provider,
            totalAccounts: list.length,
            activeAccounts: list.filter(a => a.isActive).length,
            lastUpdatedAt: list.reduce((max, a) => Math.max(max, a.updatedAt), 0) || undefined,
            oldestAccountAt: list.reduce((min, a) => Math.min(min, a.createdAt), Number.MAX_SAFE_INTEGER) || undefined,
            withRefreshToken: list.filter(a => !!a.refreshToken).length,
            withSessionToken: list.filter(a => !!a.sessionToken).length
        })).sort((a, b) => a.provider.localeCompare(b.provider));
    }

    async rotateTokenEncryption(provider?: string): Promise<{ rotated: number; failed: number }> {
        const targetProvider = provider ? this.normalizeProvider(provider) : undefined;
        const accounts = targetProvider
            ? await this.databaseService.getLinkedAccounts(targetProvider)
            : await this.databaseService.getLinkedAccounts();

        let rotated = 0;
        let failed = 0;

        for (const account of accounts) {
            try {
                const updated = { ...account };
                let changed = false;

                if (account.accessToken) {
                    const plain = this.decrypt(account.accessToken);
                    if (plain) { updated.accessToken = this.encrypt(plain); changed = true; }
                }
                if (account.refreshToken) {
                    const plain = this.decrypt(account.refreshToken);
                    if (plain) { updated.refreshToken = this.encrypt(plain); changed = true; }
                }
                if (account.sessionToken) {
                    const plain = this.decrypt(account.sessionToken);
                    if (plain) { updated.sessionToken = this.encrypt(plain); changed = true; }
                }

                if (changed) {
                    updated.updatedAt = Date.now();
                    await this.databaseService.saveLinkedAccount(updated);
                    rotated += 1;
                }
            } catch {
                failed += 1;
            }
        }

        return { rotated, failed };
    }

    /**
     * Updates authentication data received from the proxy process.
     * This is a specialized wrapper around linkAccountWithId.
     */
    async updateFromProxy(data: Partial<JsonObject>): Promise<void> {
        const provider = typeof data.provider === 'string' ? data.provider : '';
        const accountId = typeof data.accountId === 'string' ? data.accountId : '';
        const tokenDataValue = data.tokenData;
        const isTokenDataObject = tokenDataValue !== undefined
            && tokenDataValue !== null
            && typeof tokenDataValue === 'object'
            && !Array.isArray(tokenDataValue);
        const tokenData = isTokenDataObject
            ? this.normalizeProxyTokenData(tokenDataValue as JsonObject)
            : undefined;

        if (!provider || !accountId || !tokenData) {
            throw new ValidationError('Invalid auth update from proxy: missing required fields');
        }

        appLogger.debug('AuthService', `Updating auth from proxy for ${provider}:${accountId}`);
        await this.linkAccountWithId(provider, accountId, tokenData);
    }

    private normalizeProxyTokenData(tokenData: JsonObject): TokenData {
        const key = typeof tokenData.key === 'string'
            ? tokenData.key
            : undefined;
        const accessToken = typeof tokenData.accessToken === 'string'
            ? tokenData.accessToken
            : typeof tokenData.access_token === 'string'
                ? tokenData.access_token
                : key;
        const refreshToken = typeof tokenData.refreshToken === 'string'
            ? tokenData.refreshToken
            : typeof tokenData.refresh_token === 'string'
                ? tokenData.refresh_token
                : undefined;
        const sessionToken = typeof tokenData.sessionToken === 'string'
            ? tokenData.sessionToken
            : typeof tokenData.session_token === 'string'
                ? tokenData.session_token
                : undefined;
        const email = typeof tokenData.email === 'string' ? tokenData.email : undefined;
        const displayName = typeof tokenData.displayName === 'string'
            ? tokenData.displayName
            : typeof tokenData.display_name === 'string'
                ? tokenData.display_name
                : undefined;
        const avatarUrl = typeof tokenData.avatarUrl === 'string'
            ? tokenData.avatarUrl
            : typeof tokenData.avatar_url === 'string'
                ? tokenData.avatar_url
                : undefined;
        const expiresAt = typeof tokenData.expiresAt === 'number'
            ? tokenData.expiresAt
            : typeof tokenData.expires_at === 'number'
                ? tokenData.expires_at
                : undefined;
        const scope = typeof tokenData.scope === 'string' ? tokenData.scope : undefined;
        const metadata = typeof tokenData.metadata === 'object' && tokenData.metadata !== null && !Array.isArray(tokenData.metadata)
            ? tokenData.metadata as JsonObject
            : tokenData;

        return {
            key,
            accessToken,
            refreshToken,
            sessionToken,
            email,
            displayName,
            avatarUrl,
            expiresAt,
            scope,
            metadata
        };
    }

    async revokeAccountTokens(
        accountId: string,
        options: { revokeAccess?: boolean; revokeRefresh?: boolean; revokeSession?: boolean } = {}
    ): Promise<void> {
        const accounts = await this.databaseService.getLinkedAccounts();
        const account = accounts.find(a => a.id === accountId);
        if (!account) { return; }

        const revokeAccess = options.revokeAccess ?? true;
        const revokeRefresh = options.revokeRefresh ?? true;
        const revokeSession = options.revokeSession ?? true;

        const updated: LinkedAccount = {
            ...account,
            accessToken: revokeAccess ? undefined : account.accessToken,
            refreshToken: revokeRefresh ? undefined : account.refreshToken,
            sessionToken: revokeSession ? undefined : account.sessionToken,
            expiresAt: revokeAccess ? undefined : account.expiresAt,
            updatedAt: Date.now(),
            metadata: {
                ...(account.metadata ?? {}),
                revokedAt: Date.now(),
                revokedBy: 'auth-service'
            }
        };

        await this.databaseService.saveLinkedAccount(updated);
        this.eventBus.emit('account:updated', { accountId: account.id, provider: account.provider });
    }

    async getTokenAnalytics(provider?: string): Promise<TokenAnalytics> {
        const accounts = provider
            ? await this.databaseService.getLinkedAccounts(this.normalizeProvider(provider))
            : await this.databaseService.getLinkedAccounts();
        const now = Date.now();

        return {
            totalAccounts: accounts.length,
            withAccessToken: accounts.filter(a => !!a.accessToken).length,
            withRefreshToken: accounts.filter(a => !!a.refreshToken).length,
            withSessionToken: accounts.filter(a => !!a.sessionToken).length,
            expiringWithin30m: accounts.filter(a => !!a.expiresAt && a.expiresAt > now && (a.expiresAt - now) < 30 * 60 * 1000).length,
            expired: accounts.filter(a => this.isExpired(a)).length,
            revoked: accounts.filter(a => Boolean(a.metadata?.revokedAt)).length
        };
    }

    /**
     * Exports linked account credentials as an encrypted payload.
     */
    async exportCredentials(
        options: CredentialExportOptions
    ): Promise<{ payload: string; checksum: string; expiresAt: number }> {
        this.validateExportPassword(options.password);
        const expiresInHours = this.normalizeExportExpiryHours(options.expiresInHours);
        const now = Date.now();
        const expiresAt = now + expiresInHours * 60 * 60 * 1000;
        const provider = options.provider ? this.normalizeProvider(options.provider) : undefined;
        const accounts = provider
            ? await this.databaseService.getLinkedAccounts(provider)
            : await this.databaseService.getLinkedAccounts();
        const exportableAccounts = accounts
            .map(account => this.toCredentialExportAccount(account))
            .filter(account => account.accessToken || account.refreshToken || account.sessionToken);

        if (exportableAccounts.length === 0) {
            throw new ValidationError('No linked credentials available for export');
        }

        const payload: CredentialExportPayload = {
            schemaVersion: CREDENTIAL_EXPORT_PAYLOAD_SCHEMA_VERSION,
            createdAt: now,
            expiresAt,
            accounts: exportableAccounts
        };
        const serializedPayload = JSON.stringify(payload);
        const checksum = this.computeChecksum(serializedPayload);
        const encrypted = this.encryptCredentialPayload(serializedPayload, options.password);
        const packagePayload: CredentialExportPackage = {
            schemaVersion: CREDENTIAL_EXPORT_PACKAGE_SCHEMA_VERSION,
            createdAt: now,
            expiresAt,
            checksum,
            ...encrypted
        };

        return {
            payload: JSON.stringify(packagePayload),
            checksum,
            expiresAt
        };
    }

    /**
     * Imports linked account credentials from an encrypted export payload.
     */
    async importCredentials(payloadText: string, password: string): Promise<CredentialImportResult> {
        this.validateExportPassword(password);
        const bundle = this.parseCredentialExportPackage(payloadText);
        if (Date.now() > bundle.expiresAt) {
            throw new ValidationError('Credential export package has expired');
        }

        const serializedPayload = this.decryptCredentialPayload(bundle, password);
        const checksum = this.computeChecksum(serializedPayload);
        if (checksum !== bundle.checksum) {
            throw new ValidationError('Credential export checksum verification failed');
        }

        const payload = this.parseCredentialExportPayload(serializedPayload);
        if (Date.now() > payload.expiresAt) {
            throw new ValidationError('Credential export payload has expired');
        }

        let imported = 0;
        let skipped = 0;

        for (const account of payload.accounts) {
            if (!account.provider || !account.id) {
                skipped += 1;
                appLogger.warn('AuthService', 'Skipping credential import entry with missing provider/id');
                continue;
            }
            if (!account.accessToken && !account.refreshToken && !account.sessionToken) {
                skipped += 1;
                appLogger.warn(
                    'AuthService',
                    `Skipping credential import entry without tokens: ${account.provider}/${account.id}`
                );
                continue;
            }

            try {
                await this.linkAccountWithId(account.provider, account.id, {
                    accessToken: account.accessToken,
                    refreshToken: account.refreshToken,
                    sessionToken: account.sessionToken,
                    expiresAt: account.expiresAt,
                    email: account.email,
                    displayName: account.displayName,
                    avatarUrl: account.avatarUrl,
                    scope: account.scope,
                    metadata: account.metadata
                });
                if (account.isActive) {
                    await this.setActiveAccount(account.provider, account.id);
                }
                imported += 1;
            } catch (error) {
                skipped += 1;
                appLogger.error(
                    'AuthService',
                    `Failed to import account ${account.provider}/${account.id}`,
                    error as Error
                );
            }
        }

        if (imported === 0 && skipped > 0) {
            throw new TengraError('Credential import failed for all accounts', AppErrorCode.AUTH_ERROR);
        }

        return { imported, skipped, expiresAt: payload.expiresAt };
    }

    startSession(provider: string, accountId?: string, source?: string): string {
        const normalized = this.normalizeProvider(provider);
        const id = uuidv4();
        const now = Date.now();
        this.sessions.set(id, {
            id,
            provider: normalized,
            accountId,
            createdAt: now,
            lastSeenAt: now,
            source
        });
        this.enforceSessionLimit(normalized);
        return id;
    }

    touchSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) { return false; }
        session.lastSeenAt = Date.now();
        this.sessions.set(sessionId, session);
        return true;
    }

    endSession(sessionId: string): boolean {
        return this.sessions.delete(sessionId);
    }

    setSessionLimit(provider: string, limit: number): number {
        const normalized = this.normalizeProvider(provider);
        const bounded = Math.max(1, Math.floor(limit));
        this._providerSessionLimits.set(normalized, bounded);
        this.enforceSessionLimit(normalized);
        return bounded;
    }

    setSessionIdleTimeout(timeoutMs: number): number {
        const bounded = Math.max(60_000, Math.min(timeoutMs, 7 * 24 * 60 * 60 * 1000));
        this._sessionIdleTtlMs = bounded;
        return this._sessionIdleTtlMs;
    }

    getSessionIdleTimeout(): number {
        return this._sessionIdleTtlMs;
    }

    getSessionAnalytics(provider?: string): {
        totalActiveSessions: number;
        byProvider: Record<string, number>;
        oldestSessionAt?: number;
    } {
        const now = Date.now();
        for (const [id, session] of this.sessions.entries()) {
            if ((now - session.lastSeenAt) > this._sessionIdleTtlMs) {
                this.sessions.delete(id);
            }
        }

        const providerFilter = provider ? this.normalizeProvider(provider) : undefined;
        const sessions = Array.from(this.sessions.values())
            .filter(s => !providerFilter || s.provider === providerFilter);
        const byProvider: Record<string, number> = {};
        for (const session of sessions) {
            byProvider[session.provider] = (byProvider[session.provider] ?? 0) + 1;
        }

        const oldestSessionAt = sessions.length > 0
            ? sessions.reduce((min, s) => Math.min(min, s.createdAt), Number.MAX_SAFE_INTEGER)
            : undefined;

        return {
            totalActiveSessions: sessions.length,
            byProvider,
            oldestSessionAt
        };
    }

    private enforceSessionLimit(provider: string): void {
        const limit = this._providerSessionLimits.get(provider) ?? this._defaultSessionLimit;
        const sessions = Array.from(this.sessions.values())
            .filter(s => s.provider === provider)
            .sort((a, b) => a.lastSeenAt - b.lastSeenAt);

        while (sessions.length > limit) {
            const oldest = sessions.shift();
            if (!oldest) { break; }
            this.sessions.delete(oldest.id);
        }
    }

    private toCredentialExportAccount(account: LinkedAccount): CredentialExportAccount {
        return {
            id: account.id,
            provider: account.provider,
            email: account.email,
            displayName: account.displayName,
            avatarUrl: account.avatarUrl,
            accessToken: this.decrypt(account.accessToken),
            refreshToken: this.decrypt(account.refreshToken),
            sessionToken: this.decrypt(account.sessionToken),
            expiresAt: account.expiresAt,
            scope: account.scope,
            isActive: account.isActive,
            metadata: account.metadata,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt
        };
    }

    private parseCredentialExportPackage(payloadText: string): CredentialExportPackage {
        let parsed: JsonValue;
        try {
            parsed = JSON.parse(payloadText);
        } catch (error) {
            throw new ValidationError(`Invalid credential export package JSON: ${getErrorMessage(error as Error)}`);
        }

        if (!parsed || typeof parsed !== 'object') {
            throw new ValidationError('Invalid credential export package');
        }

        const pkg = parsed as Partial<CredentialExportPackage>;
        if (
            pkg.schemaVersion !== CREDENTIAL_EXPORT_PACKAGE_SCHEMA_VERSION ||
            !pkg.salt ||
            !pkg.iv ||
            !pkg.authTag ||
            !pkg.encryptedPayload ||
            !pkg.checksum ||
            typeof pkg.expiresAt !== 'number'
        ) {
            throw new ValidationError('Credential export package schema mismatch');
        }

        return pkg as CredentialExportPackage;
    }

    private parseCredentialExportPayload(serializedPayload: string): CredentialExportPayload {
        let parsed: JsonValue;
        try {
            parsed = JSON.parse(serializedPayload);
        } catch (error) {
            throw new ValidationError(`Invalid credential export payload JSON: ${getErrorMessage(error as Error)}`);
        }

        if (!parsed || typeof parsed !== 'object') {
            throw new ValidationError('Invalid credential export payload');
        }

        const payload = parsed as Partial<CredentialExportPayload>;
        if (
            payload.schemaVersion !== CREDENTIAL_EXPORT_PAYLOAD_SCHEMA_VERSION ||
            typeof payload.expiresAt !== 'number' ||
            !Array.isArray(payload.accounts)
        ) {
            throw new ValidationError('Credential export payload schema mismatch');
        }
        return payload as CredentialExportPayload;
    }

    private encryptCredentialPayload(
        payload: string,
        password: string
    ): Pick<CredentialExportPackage, 'salt' | 'iv' | 'authTag' | 'encryptedPayload'> {
        const salt = randomBytes(16);
        const iv = randomBytes(12);
        const key = this.deriveExportKey(password, salt);
        const cipher = createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();

        return {
            salt: salt.toString('base64'),
            iv: iv.toString('base64'),
            authTag: authTag.toString('base64'),
            encryptedPayload: encrypted.toString('base64')
        };
    }

    private decryptCredentialPayload(bundle: CredentialExportPackage, password: string): string {
        const salt = Buffer.from(bundle.salt, 'base64');
        const iv = Buffer.from(bundle.iv, 'base64');
        const authTag = Buffer.from(bundle.authTag, 'base64');
        const encryptedPayload = Buffer.from(bundle.encryptedPayload, 'base64');
        const key = this.deriveExportKey(password, salt);

        try {
            const decipher = createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(authTag);
            const decrypted = Buffer.concat([
                decipher.update(encryptedPayload),
                decipher.final()
            ]);
            return decrypted.toString('utf8');
        } catch (error) {
            throw new TengraError(
                `Failed to decrypt credential export package: ${getErrorMessage(error as Error)}`,
                AppErrorCode.AUTH_ERROR
            );
        }
    }

    private deriveExportKey(password: string, salt: Buffer): Buffer {
        return scryptSync(password, salt, 32);
    }

    private computeChecksum(content: string): string {
        return createHash('sha256').update(content, 'utf8').digest('hex');
    }

    private validateExportPassword(password: string): void {
        if (password.length < EXPORT_PASSWORD_MIN_LENGTH) {
            throw new ValidationError(`Export password must be at least ${EXPORT_PASSWORD_MIN_LENGTH} characters`);
        }
    }

    private normalizeExportExpiryHours(expiresInHours?: number): number {
        if (expiresInHours === undefined) {
            return DEFAULT_EXPORT_EXPIRY_HOURS;
        }
        if (!Number.isFinite(expiresInHours)) {
            throw new ValidationError('Export expiration must be a finite number');
        }
        const normalized = Math.floor(expiresInHours);
        if (normalized < 1 || normalized > MAX_EXPORT_EXPIRY_HOURS) {
            throw new ValidationError(`Export expiration must be between 1 and ${MAX_EXPORT_EXPIRY_HOURS} hours`);
        }
        return normalized;
    }

    private async checkAndUpgradeEncryption(account: LinkedAccount): Promise<void> {
        if (this.upgradingAccountIds.has(account.id)) {
            return;
        }

        let needsUpgrade = false;
        const updated: Partial<LinkedAccount> = {};

        const props: Array<keyof LinkedAccount> = ['accessToken', 'refreshToken', 'sessionToken'];
        for (const key of props) {
            const val = account[key];
            if (typeof val === 'string' && val.length > 0 && !val.startsWith('Tengra:v1:')) {
                const decryptedValue = this.decrypt(val);
                if (decryptedValue) {
                    updated[key as 'accessToken' | 'refreshToken' | 'sessionToken'] = this.encrypt(decryptedValue);
                    needsUpgrade = true;
                }
            }
        }

        if (needsUpgrade) {
            this.upgradingAccountIds.add(account.id);
            try {
                const upgradedAccount: LinkedAccount = {
                    ...account,
                    ...updated,
                    updatedAt: Date.now()
                };
                appLogger.debug('AuthService', `Upgrading encryption format for account ${account.id} (${account.provider})`);
                await this.databaseService.saveLinkedAccount(upgradedAccount);
                this.upsertLinkedAccountCache(upgradedAccount);
            } finally {
                this.upgradingAccountIds.delete(account.id);
            }
        }
    }


    // --- Helper Methods ---

    private async findAccountByEmail(provider: string, email?: string): Promise<LinkedAccount | undefined> {
        const accounts = await this.databaseService.getLinkedAccounts(provider);
        return accounts.find(a => a.email === email);
    }

    private toPublicAccount(account: LinkedAccount): LinkedAccountInfo {
        const decryptionError = this.hasDecryptionError(account);
        return {
            id: account.id,
            provider: this.normalizeProvider(account.provider),
            email: account.email,
            displayName: account.displayName,
            avatarUrl: account.avatarUrl,
            isActive: account.isActive,
            createdAt: account.createdAt,
            decryptionError
        };
    }

    private hasDecryptionError(account: LinkedAccount): boolean {
        const props: Array<keyof LinkedAccount> = ['accessToken', 'refreshToken', 'sessionToken'];
        for (const key of props) {
            const val = account[key];
            if (typeof val === 'string' && val.length > 0) {
                if (this.securityService.decryptSync(val) === null) {
                    return true;
                }
            }
        }
        return false;
    }

    private encrypt(text: string | undefined): string | undefined {
        if (!text) { return undefined; }
        return this.securityService.encryptSync(text);
    }

    private decrypt(text: string | undefined): string | undefined {
        if (!text) { return undefined; }
        return this.securityService.decryptSync(text) ?? undefined;
    }

    getRuntimeMasterKeyHex(): string | null {
        return this.securityService.getMasterKeyHex();
    }

    private isExpired(account: LinkedAccount): boolean {
        const normalizedProvider = this.normalizeProvider(account.provider ?? '');
        // Copilot session/access tokens may remain renewable even when reported expiresAt is stale.
        // Do not mark as expired while we still have renewable credentials.
        if (
            normalizedProvider === 'copilot'
            && (Boolean(account.sessionToken) || Boolean(account.refreshToken) || Boolean(account.accessToken))
        ) {
            return false;
        }
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
            'google': 'antigravity',
            'google_token': 'antigravity',
            'gemini': 'antigravity',
            'gemini_key': 'antigravity',
            'anthropic': 'anthropic',
            'anthropic_key': 'anthropic',
            'claude': 'claude',
            'openai': 'codex',
            'openai_key': 'codex',
            'codex': 'codex',
            'nvidia': 'nvidia',
            'nvidia_key': 'nvidia'
        };

        return mappings[p] ?? p;
    }
}
