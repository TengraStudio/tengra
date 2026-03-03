import { IpcRenderer } from 'electron';

export interface LinkedAccountInfo {
    id: string;
    provider: string;
    email?: string;
    username?: string;
    active: boolean;
    lastCheckedAt?: number;
    expiresAt?: number;
}

export type TokenData = {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    tokenType?: string;
    scope?: string;
};

export interface LinkedAccountsBridge {
    getLinkedAccounts: (provider?: string) => Promise<LinkedAccountInfo[]>;
    getActiveLinkedAccount: (provider: string) => Promise<LinkedAccountInfo | null>;
    setActiveLinkedAccount: (
        provider: string,
        accountId: string
    ) => Promise<{ success: boolean; error?: string }>;
    linkAccount: (
        provider: string,
        tokenData: TokenData
    ) => Promise<{ success: boolean; account?: LinkedAccountInfo; error?: string }>;
    unlinkAccount: (accountId: string) => Promise<{ success: boolean; error?: string }>;
    unlinkProvider: (provider: string) => Promise<{ success: boolean; error?: string }>;
    hasLinkedAccount: (provider: string) => Promise<boolean>;
    getAccountsByProvider: (provider: string) => Promise<LinkedAccountInfo[]>;
    detectAuthProvider: (providerHint?: string, tokenData?: TokenData) => Promise<{ provider: string }>;
    getAuthProviderHealth: (provider?: string) => Promise<Array<{
        provider: string;
        checkedAt: number;
        totalAccounts: number;
        activeAccountId?: string;
        hasActiveToken: boolean;
        hasRefreshToken: boolean;
        expiringSoonCount: number;
        expiredCount: number;
        healthy: boolean;
    }>>;
    getAuthProviderAnalytics: () => Promise<Array<{
        provider: string;
        totalAccounts: number;
        activeAccounts: number;
        lastUpdatedAt?: number;
        oldestAccountAt?: number;
        withRefreshToken: number;
        withSessionToken: number;
    }>>;
    rotateTokenEncryption: (provider?: string) => Promise<{ rotated: number; failed: number }>;
    revokeAccountToken: (
        accountId: string,
        options?: { revokeAccess?: boolean; revokeRefresh?: boolean; revokeSession?: boolean }
    ) => Promise<{ success: boolean }>;
    getTokenAnalytics: (provider?: string) => Promise<{
        totalAccounts: number;
        withAccessToken: number;
        withRefreshToken: number;
        withSessionToken: number;
        expiringWithin30m: number;
        expired: number;
        revoked: number;
    }>;
    exportCredentials: (options: {
        provider?: string;
        password: string;
        expiresInHours?: number;
    }) => Promise<{ success: boolean; payload?: string; checksum?: string; expiresAt?: number; error?: string }>;
    importCredentials: (
        payload: string,
        password: string
    ) => Promise<{ success: boolean; imported?: number; skipped?: number; expiresAt?: number; error?: string }>;
    createMasterKeyBackup: (
        passphrase: string
    ) => Promise<{ success: boolean; backup?: string; error?: string }>;
    restoreMasterKeyBackup: (
        backupPayload: string,
        passphrase: string
    ) => Promise<{ success: boolean; error?: string }>;
}

export function createLinkedAccountsBridge(ipc: IpcRenderer): LinkedAccountsBridge {
    return {
        getLinkedAccounts: provider => ipc.invoke('auth:get-linked-accounts', provider),
        getActiveLinkedAccount: provider => ipc.invoke('auth:get-active-linked-account', provider),
        setActiveLinkedAccount: (provider, accountId) =>
            ipc.invoke('auth:set-active-linked-account', provider, accountId),
        linkAccount: (provider, tokenData) =>
            ipc.invoke('auth:link-account', provider, tokenData),
        unlinkAccount: accountId => ipc.invoke('auth:unlink-account', accountId),
        unlinkProvider: provider => ipc.invoke('auth:unlink-provider', provider),
        hasLinkedAccount: provider => ipc.invoke('auth:has-linked-account', provider),
        getAccountsByProvider: provider => ipc.invoke('auth:get-accounts-by-provider', provider),
        detectAuthProvider: (providerHint, tokenData) =>
            ipc.invoke('auth:detect-auth-provider', { providerHint, tokenData }),
        getAuthProviderHealth: provider => ipc.invoke('auth:get-provider-health', provider),
        getAuthProviderAnalytics: () => ipc.invoke('auth:get-provider-analytics'),
        rotateTokenEncryption: provider => ipc.invoke('auth:rotate-token-encryption', provider),
        revokeAccountToken: (accountId, options) =>
            ipc.invoke('auth:revoke-account-token', accountId, options),
        getTokenAnalytics: provider => ipc.invoke('auth:get-token-analytics', provider),
        exportCredentials: options => ipc.invoke('auth:export-credentials', options),
        importCredentials: (payload, password) =>
            ipc.invoke('auth:import-credentials', { payload, password }),
        createMasterKeyBackup: passphrase => ipc.invoke('auth:create-master-key-backup', passphrase),
        restoreMasterKeyBackup: (backupPayload, passphrase) =>
            ipc.invoke('auth:restore-master-key-backup', backupPayload, passphrase),
    };
}
