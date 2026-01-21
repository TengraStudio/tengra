import { appLogger } from '@main/logging/logger'
import { BaseService } from '@main/services/base.service'
import { DatabaseService, LinkedAccount } from '@main/services/data/database.service'
import { SecurityService } from '@main/services/security/security.service'
import { JsonObject } from '@shared/types/common'
import { getErrorMessage } from '@shared/utils/error.util'
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

        // Proactively migrate all tokens to new encryption format
        await this.migrateExistingTokens()
    }

    /**
     * Proactively migrates all tokens in the database to the new secure encryption format.
     */
    private async migrateExistingTokens(): Promise<void> {
        try {
            const accounts = await this.databaseService.getLinkedAccounts()
            let migratedCount = 0

            for (const account of accounts) {
                let needsUpgrade = false
                const updated: Partial<LinkedAccount> = {}

                const checkAndSet = (val: string | undefined, key: 'accessToken' | 'refreshToken' | 'sessionToken') => {
                    if (val && !val.startsWith('orbit:v1:')) {
                        const decryptedValue = this.decrypt(val)
                        updated[key] = this.encrypt(decryptedValue)
                        needsUpgrade = true
                    }
                }

                checkAndSet(account.accessToken, 'accessToken')
                checkAndSet(account.refreshToken, 'refreshToken')
                checkAndSet(account.sessionToken, 'sessionToken')

                if (needsUpgrade) {
                    await this.databaseService.saveLinkedAccount({ ...account, ...updated })
                    migratedCount++
                }
            }

            if (migratedCount > 0) {
                appLogger.info('AuthService', `Proactive migration complete: Upgraded ${migratedCount} accounts to orbit:v1 format.`)
            }
        } catch (error) {
            appLogger.error('AuthService', `Proactive migration failed: ${getErrorMessage(error)}`)
        }
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

        const decrypted = {
            ...account,
            accessToken: this.decrypt(account.accessToken),
            refreshToken: this.decrypt(account.refreshToken),
            sessionToken: this.decrypt(account.sessionToken)
        }

        // Auto-upgrade encryption if needed
        void this.checkAndUpgradeEncryption(account)

        return decrypted
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
        const fullAccounts: LinkedAccount[] = []

        for (const a of accounts) {
            fullAccounts.push({
                ...a,
                accessToken: this.decrypt(a.accessToken),
                refreshToken: this.decrypt(a.refreshToken),
                sessionToken: this.decrypt(a.sessionToken)
            })
            // Background upgrade check
            void this.checkAndUpgradeEncryption(a)
        }
        return fullAccounts
    }

    private async checkAndUpgradeEncryption(account: LinkedAccount): Promise<void> {
        let needsUpgrade = false
        const updated: Partial<LinkedAccount> = {}

        const checkAndSet = (val: string | undefined, key: 'accessToken' | 'refreshToken' | 'sessionToken') => {
            if (val && !val.startsWith('orbit:v1:')) {
                const decryptedValue = this.decrypt(val)
                updated[key] = this.encrypt(decryptedValue)
                needsUpgrade = true
            }
        }

        checkAndSet(account.accessToken, 'accessToken')
        checkAndSet(account.refreshToken, 'refreshToken')
        checkAndSet(account.sessionToken, 'sessionToken')

        if (needsUpgrade) {
            appLogger.info('AuthService', `Upgrading encryption format for account ${account.id} (${account.provider})`)
            await this.databaseService.saveLinkedAccount({ ...account, ...updated })
        }
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
        return this.securityService.encryptSync(text)
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
