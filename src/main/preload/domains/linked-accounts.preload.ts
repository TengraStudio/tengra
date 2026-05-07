/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { AUTH_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcRenderer } from 'electron';

export interface LinkedAccountInfo {
    id: string;
    provider: string;
    email?: string;
    username?: string;
    active: boolean;
    lastCheckedAt?: number;
    expiresAt?: number;
    decryptionError?: boolean;
}

export type TokenData = {
    key?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    tokenType?: string;
    scope?: string;
};

export interface LinkedAccountsBridge {
    getLinkedAccounts: (provider?: string) => Promise<LinkedAccountInfo[]>;
    getAllAccounts: () => Promise<LinkedAccountInfo[]>;
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
        getLinkedAccounts: provider => ipc.invoke(AUTH_CHANNELS.GET_LINKED_ACCOUNTS, provider),
        getAllAccounts: () => ipc.invoke(AUTH_CHANNELS.GET_LINKED_ACCOUNTS),
        getActiveLinkedAccount: provider => ipc.invoke(AUTH_CHANNELS.GET_ACTIVE_LINKED_ACCOUNT, provider),
        setActiveLinkedAccount: (provider, accountId) =>
            ipc.invoke(AUTH_CHANNELS.SET_ACTIVE_LINKED_ACCOUNT, provider, accountId),
        linkAccount: (provider, tokenData) =>
            ipc.invoke(AUTH_CHANNELS.LINK_ACCOUNT, provider, tokenData),
        unlinkAccount: accountId => ipc.invoke(AUTH_CHANNELS.UNLINK_ACCOUNT, accountId),
        unlinkProvider: provider => ipc.invoke(AUTH_CHANNELS.UNLINK_PROVIDER, provider),
        hasLinkedAccount: provider => ipc.invoke(AUTH_CHANNELS.HAS_LINKED_ACCOUNT, provider),
        getAccountsByProvider: provider => ipc.invoke(AUTH_CHANNELS.GET_ACCOUNTS_BY_PROVIDER, provider),
        detectAuthProvider: (providerHint, tokenData) =>
            ipc.invoke(AUTH_CHANNELS.DETECT_PROVIDER, { providerHint, tokenData }),
        getAuthProviderHealth: provider => ipc.invoke(AUTH_CHANNELS.GET_PROVIDER_HEALTH, provider),
        getAuthProviderAnalytics: () => ipc.invoke(AUTH_CHANNELS.GET_PROVIDER_ANALYTICS),
        rotateTokenEncryption: provider => ipc.invoke(AUTH_CHANNELS.ROTATE_TOKEN_ENCRYPTION, provider),
        revokeAccountToken: (accountId, options) =>
            ipc.invoke(AUTH_CHANNELS.REVOKE_ACCOUNT_TOKEN, accountId, options),
        getTokenAnalytics: provider => ipc.invoke(AUTH_CHANNELS.GET_TOKEN_ANALYTICS, provider),
        exportCredentials: options => ipc.invoke(AUTH_CHANNELS.EXPORT_CREDENTIALS, options),
        importCredentials: (payload, password) =>
            ipc.invoke(AUTH_CHANNELS.IMPORT_CREDENTIALS, { payload, password }),
        createMasterKeyBackup: passphrase => ipc.invoke(AUTH_CHANNELS.CREATE_MASTER_KEY_BACKUP, passphrase),
        restoreMasterKeyBackup: (backupPayload, passphrase) =>
            ipc.invoke(AUTH_CHANNELS.RESTORE_MASTER_KEY_BACKUP, backupPayload, passphrase),
    };
}

