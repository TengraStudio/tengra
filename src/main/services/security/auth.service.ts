import { appLogger } from '@main/logging/logger'
import { BaseService } from '@main/services/base.service'
import { AuthToken, DatabaseService, LinkedAccount } from '@main/services/data/database.service'
import { SecurityService } from '@main/services/security/security.service'
import { JsonObject } from '@shared/types/common'
import { v4 as uuidv4 } from 'uuid'

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
        private securityService: SecurityService
    ) {
        super('AuthService')
    }

    override async initialize(): Promise<void> {
        await this.databaseService.initialize()
        appLogger.info('AuthService', 'Initialized with new multi-account system')
    }

    // --- Provider Methods ---

    /**
     * Get all linked accounts for a provider.
     */
    async getAccountsByProvider(provider: string): Promise<LinkedAccountInfo[]> {
        const normalized = this.normalizeProvider(provider)
        const accounts = await this.databaseService.getLinkedAccounts(normalized)
        return accounts.map(a => this.toPublicAccount(a))
    }

    /**
     * Get the active (selected) account for a provider.
     */
    async getActiveAccount(provider: string): Promise<LinkedAccountInfo | null> {
        const normalized = this.normalizeProvider(provider)
        const account = await this.databaseService.getActiveLinkedAccount(normalized)
        return account ? this.toPublicAccount(account) : null
    }

    /**
     * Get the active account's token for a provider.
     */
    async getActiveToken(provider: string): Promise<string | undefined> {
        const normalized = this.normalizeProvider(provider)
        const account = await this.databaseService.getActiveLinkedAccount(normalized)
        if (!account) { return undefined }

        return this.decrypt(account.accessToken) ??
            this.decrypt(account.sessionToken) ??
            this.decrypt(account.refreshToken)
    }

    /**
     * Get the full active account with decrypted tokens.
     */
    async getActiveAccountFull(provider: string): Promise<LinkedAccount | null> {
        const normalized = this.normalizeProvider(provider)
        const account = await this.databaseService.getActiveLinkedAccount(normalized)
        if (!account) { return null }

        return {
            ...account,
            accessToken: this.decrypt(account.accessToken),
            refreshToken: this.decrypt(account.refreshToken),
            sessionToken: this.decrypt(account.sessionToken)
        }
    }

    /**
     * Set which account should be active for a provider.
     */
    async setActiveAccount(provider: string, accountId: string): Promise<void> {
        const normalized = this.normalizeProvider(provider)
        await this.databaseService.setActiveLinkedAccount(normalized, accountId)
        appLogger.info('AuthService', `Set active account for ${normalized}: ${accountId}`)
    }

    // --- Account Linking ---

    /**
     * Link a new account for a provider.
     */
    async linkAccount(provider: string, tokenData: TokenData): Promise<LinkedAccountInfo> {
        const normalized = this.normalizeProvider(provider)
        const now = Date.now()

        // Check if account with same email already exists
        let existing = await this.findAccountByEmail(normalized, tokenData.email)

        // If no email provided (e.g. proxy_key), check if we have any account for this provider
        // This handles "singleton" providers where we only want one instance
        if (!existing && !tokenData.email) {
            const accounts = await this.databaseService.getLinkedAccounts(normalized)
            if (accounts.length > 0) {
                existing = accounts[0]
            }
        }

        const account: LinkedAccount = {
            id: existing?.id ?? uuidv4(),
            provider: normalized,
            email: tokenData.email,
            displayName: tokenData.displayName,
            avatarUrl: tokenData.avatarUrl,
            accessToken: tokenData.accessToken ? this.encrypt(tokenData.accessToken) : undefined,
            refreshToken: tokenData.refreshToken ? this.encrypt(tokenData.refreshToken) : undefined,
            sessionToken: tokenData.sessionToken ? this.encrypt(tokenData.sessionToken) : undefined,
            expiresAt: tokenData.expiresAt,
            scope: tokenData.scope,
            isActive: false,  // Will be set to true if first account
            metadata: tokenData.metadata,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now
        }

        // If this is the first account for this provider, make it active
        const existingAccounts = await this.databaseService.getLinkedAccounts(normalized)
        if (existingAccounts.length === 0 || (existingAccounts.length === 1 && existing)) {
            account.isActive = true
        }

        await this.databaseService.saveLinkedAccount(account)
        appLogger.info('AuthService', `Linked account for ${normalized}: ${tokenData.email ?? account.id}`)

        return this.toPublicAccount(account)
    }

    /**
     * Unlink (remove) a specific account.
     */
    async unlinkAccount(accountId: string): Promise<void> {
        // Get the account first to check if it's active
        const accounts = await this.databaseService.getLinkedAccounts()
        const account = accounts.find(a => a.id === accountId)

        if (!account) {
            appLogger.warn('AuthService', `Account not found for unlinking: ${accountId}`)
            return
        }

        await this.databaseService.deleteLinkedAccount(accountId)
        appLogger.info('AuthService', `Unlinked account: ${accountId}`)

        // If this was the active account, make another one active
        if (account.isActive) {
            const remainingAccounts = await this.databaseService.getLinkedAccounts(account.provider)
            if (remainingAccounts.length > 0 && remainingAccounts[0]) {
                await this.databaseService.setActiveLinkedAccount(account.provider, remainingAccounts[0].id)
                appLogger.info('AuthService', `Auto-activated next account for ${account.provider}: ${remainingAccounts[0].id}`)
            }
        }
    }

    /**
     * Unlink all accounts for a provider.
     */
    async unlinkAllForProvider(provider: string): Promise<void> {
        const normalized = this.normalizeProvider(provider)
        const accounts = await this.databaseService.getLinkedAccounts(normalized)

        for (const account of accounts) {
            await this.databaseService.deleteLinkedAccount(account.id)
        }
        appLogger.info('AuthService', `Unlinked all accounts for ${normalized}`)
    }

    /**
     * Update an existing linked account token.
     */
    async updateToken(accountId: string, tokenData: Partial<TokenData>): Promise<void> {
        const accounts = await this.databaseService.getLinkedAccounts()
        const account = accounts.find(a => a.id === accountId)
        if (!account) { return }

        const updatedAccount: LinkedAccount = {
            ...account,
            updatedAt: Date.now()
        }

        if (tokenData.accessToken) { updatedAccount.accessToken = this.encrypt(tokenData.accessToken) }
        if (tokenData.refreshToken) { updatedAccount.refreshToken = this.encrypt(tokenData.refreshToken) }
        if (tokenData.sessionToken) { updatedAccount.sessionToken = this.encrypt(tokenData.sessionToken) }
        if (tokenData.expiresAt) { updatedAccount.expiresAt = tokenData.expiresAt }
        if (tokenData.metadata) { updatedAccount.metadata = { ...account.metadata, ...tokenData.metadata } }

        await this.databaseService.saveLinkedAccount(updatedAccount)
        appLogger.info('AuthService', `Updated token for account: ${accountId}`)
    }

    /**
     * Public helper to decrypt a value (used by TokenService).
     */
    decryptToken(encryptedValue: string): string | undefined {
        return this.decrypt(encryptedValue)
    }



    // --- Query Methods ---

    /**
     * Get all linked accounts across all providers.
     */
    async getAllAccounts(): Promise<LinkedAccountInfo[]> {
        const accounts = await this.databaseService.getLinkedAccounts()
        return accounts.map(a => this.toPublicAccount(a))
    }

    /**
     * Check if a provider has any linked accounts.
     */
    async hasLinkedAccount(provider: string): Promise<boolean> {
        const normalized = this.normalizeProvider(provider)
        const accounts = await this.databaseService.getLinkedAccounts(normalized)
        return accounts.length > 0
    }

    /**
     * Get all accounts with decrypted tokens (for internal use).
     */
    async getAllAccountsFull(): Promise<LinkedAccount[]> {
        const accounts = await this.databaseService.getLinkedAccounts()
        return accounts.map(a => ({
            ...a,
            accessToken: this.decrypt(a.accessToken),
            refreshToken: this.decrypt(a.refreshToken),
            sessionToken: this.decrypt(a.sessionToken)
        }))
    }

    // --- TokenService Compatibility Methods ---
    // These methods provide backward compatibility with TokenService

    /**
     * @deprecated Use getAllAccountsFull() instead
     * TokenService compatibility: Get all tokens in AuthToken format.
     */
    async getAllFullTokens(): Promise<AuthToken[]> {
        const accounts = await this.getAllAccountsFull()
        return accounts.map(a => ({
            id: a.id,
            accountId: 'default',  // Legacy compatibility
            provider: a.provider,
            email: a.email,
            accessToken: a.accessToken,
            refreshToken: a.refreshToken,
            sessionToken: a.sessionToken,
            expiresAt: a.expiresAt,
            scope: a.scope,
            metadata: a.metadata,
            updatedAt: a.updatedAt
        }))
    }

    /**
     * @deprecated Use linkAccount() instead
     * TokenService compatibility: Save a token.
     */
    async saveToken(provider: string, token: string | Partial<AuthToken>): Promise<void> {
        const normalized = this.normalizeProvider(provider)

        let tokenData: TokenData

        if (typeof token === 'string') {
            const trimmed = token.trim()
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                try {
                    const parsed = JSON.parse(trimmed)
                    tokenData = {
                        accessToken: parsed.access_token ?? parsed.accessToken ?? token,
                        refreshToken: parsed.refresh_token ?? parsed.refreshToken,
                        sessionToken: parsed.session_token ?? parsed.sessionToken,
                        email: parsed.email,
                        expiresAt: parsed.expires_at ?? parsed.expiresAt,
                        scope: parsed.scope,
                        metadata: parsed
                    }

                    // Handle String-based expires_at (like from ProxyService)
                    if (parsed.expired && !tokenData.expiresAt) {
                        tokenData.expiresAt = new Date(parsed.expired).getTime()
                    }
                } catch {
                    tokenData = { accessToken: token }
                }
            } else {
                tokenData = { accessToken: token }
            }
        } else {
            tokenData = {
                accessToken: token.accessToken,
                refreshToken: token.refreshToken,
                sessionToken: token.sessionToken,
                email: token.email,
                expiresAt: token.expiresAt,
                scope: token.scope,
                metadata: token.metadata
            }
        }

        await this.linkAccount(normalized, tokenData)
    }

    /**
     * @deprecated Use getActiveToken() instead
     * TokenService compatibility: Get token string.
     */
    async getToken(provider: string): Promise<string | undefined> {
        return this.getActiveToken(provider)
    }

    /**
     * @deprecated Use getActiveAccountFull() instead
     * TokenService compatibility: Get full auth token.
     */
    async getAuthToken(provider: string): Promise<AuthToken | null> {
        const account = await this.getActiveAccountFull(provider)
        if (!account) { return null }

        return {
            id: account.id,
            accountId: 'default',
            provider: account.provider,
            email: account.email,
            accessToken: account.accessToken,
            refreshToken: account.refreshToken,
            sessionToken: account.sessionToken,
            expiresAt: account.expiresAt,
            scope: account.scope,
            metadata: account.metadata,
            updatedAt: account.updatedAt
        }
    }

    /**
     * @deprecated Use getAllAccounts() instead
     * TokenService compatibility: Get all tokens as key-value pairs.
     */
    async getAllTokens(): Promise<Record<string, string>> {
        const accounts = await this.getAllAccountsFull()
        const result: Record<string, string> = {}

        for (const a of accounts) {
            const token = a.accessToken ?? a.sessionToken ?? a.refreshToken
            if (token) {
                result[a.provider] = token
            }
        }

        return result
    }

    /**
     * @deprecated Use unlinkAllForProvider() instead
     * TokenService compatibility: Delete all tokens for a provider.
     */
    async deleteToken(provider: string): Promise<void> {
        await this.unlinkAllForProvider(provider)
    }

    // --- Helper Methods ---

    private async findAccountByEmail(provider: string, email?: string): Promise<LinkedAccount | undefined> {
        const accounts = await this.databaseService.getLinkedAccounts(provider)
        return accounts.find(a => a.email === email)
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
        }
    }

    private encrypt(text: string | undefined): string | undefined {
        if (!text) { return undefined }
        return this.securityService.encryptSync(text) ?? undefined
    }

    private decrypt(text: string | undefined): string | undefined {
        if (!text) { return undefined }
        return this.securityService.decryptSync(text) ?? undefined
    }

    private normalizeProvider(provider: string): string {
        let p = provider.toLowerCase()

        // Strip emails (e.g. claude-user@gmail.com -> claude)
        if (p.includes('@')) {
            const parts = p.split('-')
            p = parts[0] ?? p
        }

        // Strip common suffixes
        p = p.replace(/(_token|_key|_auth)$/, '')

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
        }

        return mappings[p] ?? p
    }
}
