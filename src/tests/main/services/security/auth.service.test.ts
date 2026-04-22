/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { DatabaseService, LinkedAccount } from '@main/services/data/database.service';
import { AuthService, TokenData } from '@main/services/security/auth.service';
import { SecurityService } from '@main/services/security/security.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger');
vi.mock('@main/services/data/database.service');
vi.mock('@main/services/security/security.service');
vi.mock('@main/services/system/event-bus.service');
vi.mock('electron', () => ({
    app: { getPath: () => '/mock/path', isPackaged: false }
}));
vi.mock('fs');
vi.mock('uuid', () => {
    let counter = 0;
    return { v4: () => `mock-uuid-${++counter}` };
});

let authService: AuthService;
let mockDatabaseService: DatabaseService;
let mockSecurityService: SecurityService;
let mockEventBus: EventBusService;

const makeAccount = (overrides: Partial<LinkedAccount> = {}): LinkedAccount => ({
    id: 'test-account-1',
    provider: 'github',
    accessToken: 'encrypted-access',
    refreshToken: 'encrypted-refresh',
    sessionToken: undefined,
    email: 'user@example.com',
    displayName: 'Test User',
    avatarUrl: undefined,
    expiresAt: Date.now() + 3600000,
    scope: 'repo',
    isActive: true,
    metadata: {},
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
    ...overrides
});

beforeEach(() => {
    vi.clearAllMocks();

    mockDatabaseService = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getLinkedAccounts: vi.fn().mockResolvedValue([]),
        getLinkedAccount: vi.fn().mockResolvedValue(null),
        getLinkedAccountById: vi.fn().mockResolvedValue(null),
        getLinkedAccountsByProvider: vi.fn().mockResolvedValue([]),
        getActiveLinkedAccount: vi.fn().mockResolvedValue(null),
        upsertLinkedAccount: vi.fn().mockResolvedValue(undefined),
        saveLinkedAccount: vi.fn().mockResolvedValue(undefined),
        deleteLinkedAccount: vi.fn().mockResolvedValue(undefined),
        setActiveLinkedAccount: vi.fn().mockResolvedValue(undefined),
    } as never as DatabaseService;

    mockSecurityService = {
        encryptSync: vi.fn((val: string) => `enc:${val}`),
        decryptSync: vi.fn((val: string) => val.startsWith('enc:') ? val.slice(4) : val),
        createEncryptedMasterKeyBackup: vi.fn().mockReturnValue({ success: true, result: { backup: 'backup-data' } }),
        restoreMasterKeyBackup: vi.fn().mockResolvedValue({ success: true }),
    } as never as SecurityService;

    mockEventBus = {
        emit: vi.fn(),
        emitCustom: vi.fn(),
        on: vi.fn().mockReturnValue(() => undefined),
        off: vi.fn()
    } as never as EventBusService;

    

    authService = new AuthService(mockDatabaseService, mockSecurityService, mockEventBus);
});

describe('AuthService - Lifecycle', () => {
    it('should initialize database on initialize', async () => {
        await authService.initialize();
        expect(mockDatabaseService.initialize).toHaveBeenCalled();
    });

    it('should complete cleanup without error', async () => {
        await authService.initialize();
        await expect(authService.cleanup()).resolves.toBeUndefined();
    });
});

describe('AuthService - Account Management', () => {
    it('should return empty array when no accounts exist', async () => {
        const accounts = await authService.getAllAccounts();
        expect(accounts).toEqual([]);
    });

    it('should link a new account', async () => {
        const tokenData: TokenData = {
            accessToken: 'my-token',
            email: 'user@example.com',
            displayName: 'User'
        };

        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([]);

        const result = await authService.linkAccount('github', tokenData);

        expect(result).toBeDefined();
        expect(result.provider).toBe('github');
        expect(mockDatabaseService.saveLinkedAccount).toHaveBeenCalled();
        expect(mockSecurityService.encryptSync).toHaveBeenCalledWith('my-token');
    });

    it('strips sensitive token fields from linked-account metadata while preserving provider state', async () => {
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([]);

        await authService.linkAccount('antigravity', {
            accessToken: 'my-token',
            email: 'user@example.com',
            metadata: {
                access_token: 'plain-access',
                refresh_token: 'plain-refresh',
                token: {
                    access_token: 'nested-access'
                },
                project_id: 'demo-project',
                tier_id: 'standard-tier'
            }
        });

        expect(mockDatabaseService.saveLinkedAccount).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: {
                    project_id: 'demo-project',
                    tier_id: 'standard-tier'
                }
            })
        );
    });

    it('should migrate legacy google accounts to antigravity on update', async () => {
        const legacyAccount = makeAccount({
            id: 'legacy-google-account',
            provider: 'google',
            isActive: true
        });
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([legacyAccount]);
        await authService.initialize();
        vi.mocked(mockDatabaseService.saveLinkedAccount).mockClear();

        await authService.linkAccountWithId('antigravity', 'legacy-google-account', {
            accessToken: 'updated-token',
            email: 'user@example.com'
        });

        expect(mockDatabaseService.saveLinkedAccount).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'legacy-google-account',
                provider: 'antigravity',
                isActive: true
            })
        );
    });

    it('preserves active selection when updating an existing linked account', async () => {
        const activeAccount = makeAccount({
            id: 'active-account',
            provider: 'github',
            isActive: true,
        });
        const inactiveAccount = makeAccount({
            id: 'inactive-account',
            provider: 'github',
            isActive: false,
            email: 'other@example.com',
        });
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([activeAccount, inactiveAccount]);
        await authService.initialize();
        vi.mocked(mockDatabaseService.saveLinkedAccount).mockClear();

        await authService.linkAccountWithId('github', 'active-account', {
            accessToken: 'updated-token',
            email: 'user@example.com',
        });

        expect(mockDatabaseService.saveLinkedAccount).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'active-account',
                provider: 'github',
                isActive: true,
            })
        );
    });

    it('should get accounts by provider', async () => {
        const account = makeAccount();
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([account]);

        const accounts = await authService.getAccountsByProvider('github');

        expect(accounts).toHaveLength(1);
        expect(accounts[0]?.provider).toBe('github');
    });

    it('should get active token decrypted', async () => {
        const account = makeAccount({ accessToken: 'enc:secret-token' });
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([account]);
        await authService.initialize();

        const token = await authService.getActiveToken('github');

        expect(token).toBe('secret-token');
        expect(mockSecurityService.decryptSync).toHaveBeenCalledWith('enc:secret-token');
    });

    it('refreshes public provider reads from the DB so externally linked accounts become visible immediately', async () => {
        const initialAccount = makeAccount({
            id: 'initial-account',
            provider: 'github'
        });
        const updatedAccount = makeAccount({
            id: 'codex_default',
            provider: 'codex'
        });
        vi.mocked(mockDatabaseService.getLinkedAccounts)
            .mockResolvedValueOnce([initialAccount])
            .mockResolvedValueOnce([initialAccount])
            .mockResolvedValueOnce([initialAccount, updatedAccount]);

        await authService.initialize();

        const accounts = await authService.getAccountsByProvider('codex');

        expect(accounts).toHaveLength(1);
        expect(accounts[0]?.id).toBe(updatedAccount.id);
        expect(mockDatabaseService.getLinkedAccounts).toHaveBeenCalledTimes(3);
    });

    it('updates the linked account cache after an encryption upgrade so the same account is not re-upgraded', async () => {
        const legacyAccount = makeAccount({
            id: 'proxy_key_default',
            provider: 'proxy_key',
            accessToken: 'legacy-proxy-token'
        });
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([legacyAccount]);
        vi.mocked(mockSecurityService.decryptSync).mockImplementation((value: string) => {
            if (value.startsWith('Tengra:v1:')) {
                return value.slice('Tengra:v1:'.length);
            }
            if (value.startsWith('enc:')) {
                return value.slice(4);
            }
            return value;
        });
        vi.mocked(mockSecurityService.encryptSync).mockImplementation((value: string) => `Tengra:v1:${value}`);

        await authService.initialize();
        vi.mocked(mockDatabaseService.saveLinkedAccount).mockClear();

        await authService.getAllAccountsFull();
        await authService.getAllAccountsFull();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockDatabaseService.saveLinkedAccount).not.toHaveBeenCalled();
    });

    it('normalizes snake_case proxy auth updates and links the emitted account id', async () => {
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([]);

        await authService.updateFromProxy({
            provider: 'codex',
            accountId: 'codex_default',
            tokenData: {
                access_token: 'proxy-access-token',
                refresh_token: 'proxy-refresh-token',
                session_token: 'proxy-session-token',
                expires_at: 1234567890,
                scope: 'openid profile',
                email: 'codex@example.com',
            },
        });

        expect(mockDatabaseService.saveLinkedAccount).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'codex_default',
                provider: 'codex',
                email: 'codex@example.com',
                scope: 'openid profile',
                expiresAt: 1234567890,
                accessToken: 'enc:proxy-access-token',
                refreshToken: 'enc:proxy-refresh-token',
                sessionToken: 'enc:proxy-session-token',
            })
        );
    });

    it('preserves richer OAuth fields when a sparse provider update arrives for the same account', async () => {
        const richAccount = makeAccount({
            id: 'antigravity_existing',
            provider: 'antigravity',
            accessToken: 'enc:old-access',
            refreshToken: 'enc:old-refresh',
            email: 'mockuser@example.com',
            displayName: 'agnes',
            expiresAt: 12345,
            metadata: {
                email: 'mockuser@example.com',
                refresh_token: 'old-refresh'
            }
        });
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([richAccount]);
        await authService.initialize();
        vi.mocked(mockDatabaseService.saveLinkedAccount).mockClear();

        await authService.linkAccountWithId('antigravity', 'antigravity_existing', {
            accessToken: 'new-access'
        });

        expect(mockDatabaseService.saveLinkedAccount).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'antigravity_existing',
                provider: 'antigravity',
                accessToken: 'enc:new-access',
                refreshToken: 'enc:old-refresh',
                email: 'mockuser@example.com',
                displayName: 'agnes',
                expiresAt: 12345
            })
        );
    });

    it('coalesces sparse OAuth updates into an existing richer account instead of creating a shadow row', async () => {
        const richAccount = makeAccount({
            id: 'antigravity_rich',
            provider: 'antigravity',
            accessToken: 'enc:old-access',
            refreshToken: 'enc:old-refresh',
            email: 'mockuser@example.com',
            displayName: 'agnes',
            isActive: true,
            metadata: {
                email: 'mockuser@example.com',
                refresh_token: 'old-refresh'
            }
        });
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([richAccount]);
        await authService.initialize();
        vi.mocked(mockDatabaseService.saveLinkedAccount).mockClear();

        await authService.linkAccountWithId('antigravity', 'antigravity_shadow', {
            accessToken: 'shadow-access'
        });

        expect(mockDatabaseService.saveLinkedAccount).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'antigravity_rich',
                provider: 'antigravity',
                accessToken: 'enc:shadow-access',
                refreshToken: 'enc:old-refresh',
                email: 'mockuser@example.com',
                isActive: true
            })
        );
    });

    it('should return undefined when no active account', async () => {
        vi.mocked(mockDatabaseService.getActiveLinkedAccount).mockResolvedValue(null);

        const token = await authService.getActiveToken('github');

        expect(token).toBeUndefined();
    });

    it('should unlink an account', async () => {
        const account = makeAccount({ isActive: false });
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([account]);

        await authService.unlinkAccount('test-account-1');

        expect(mockDatabaseService.deleteLinkedAccount).toHaveBeenCalledWith('test-account-1');
    });

    it('should silently return when unlinking non-existent account', async () => {
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([]);

        await expect(authService.unlinkAccount('nonexistent')).resolves.toBeUndefined();
    });

    it('should update token data', async () => {
        const account = makeAccount();
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([account]);

        await authService.updateToken('test-account-1', { accessToken: 'new-token' });

        expect(mockSecurityService.encryptSync).toHaveBeenCalledWith('new-token');
    });

    it('should silently return when updating non-existent account', async () => {
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([]);

        await expect(authService.updateToken('nonexistent', { accessToken: 'x' })).resolves.toBeUndefined();
    });

    it('should check account existence', async () => {
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([makeAccount()]);

        const exists = await authService.accountExists('test-account-1');
        expect(exists).toBe(true);
    });

    it('should return false for non-existent account', async () => {
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([]);

        const exists = await authService.accountExists('nonexistent');
        expect(exists).toBe(false);
    });
});

describe('AuthService - Provider Detection', () => {
    it('should detect github provider from scope', () => {
        const result = authService.detectProvider('auto', { scope: 'repo read:user' });
        expect(result).toBe('github');
    });

    it('should use explicit provider when not auto', () => {
        const result = authService.detectProvider('copilot');
        expect(result).toBe('copilot');
    });

    it('should return lowercased provider when explicit', () => {
        const result = authService.detectProvider('GitHub');
        expect(result).toBe('github');
    });
});

describe('AuthService - Sessions', () => {
    it('should start and end a session', () => {
        const sessionId = authService.startSession('github', 'account-1');
        expect(sessionId).toBeDefined();

        const ended = authService.endSession(sessionId);
        expect(ended).toBe(true);
    });

    it('should touch a session', () => {
        const sessionId = authService.startSession('github');
        const touched = authService.touchSession(sessionId);
        expect(touched).toBe(true);
    });

    it('should return false when touching non-existent session', () => {
        const touched = authService.touchSession('nonexistent');
        expect(touched).toBe(false);
    });

    it('should set and get session idle timeout', () => {
        const previous = authService.setSessionIdleTimeout(60000);
        expect(typeof previous).toBe('number');
        expect(authService.getSessionIdleTimeout()).toBe(60000);
    });

    it('should return session analytics', () => {
        authService.startSession('github');
        authService.startSession('copilot');

        const analytics = authService.getSessionAnalytics();
        expect(analytics.totalActiveSessions).toBeGreaterThanOrEqual(2);
    });
});

describe('AuthService - Master Key Backup', () => {
    it('should create a master key backup', () => {
        const backup = authService.createMasterKeyBackup('strong-passphrase');
        expect(backup).toBe('backup-data');
    });

    it('should throw when backup creation fails', () => {
        vi.mocked(mockSecurityService.createEncryptedMasterKeyBackup).mockReturnValue({
            success: false, result: null
        } as never as ReturnType<SecurityService['createEncryptedMasterKeyBackup']>);

        expect(() => authService.createMasterKeyBackup('passphrase')).toThrow();
    });

    it('should restore a master key backup', () => {
        expect(() => authService.restoreMasterKeyBackup('backup-data', 'passphrase')).not.toThrow();
    });

    it('should throw when restore fails', async () => {
        vi.mocked(mockSecurityService.restoreMasterKeyBackup).mockResolvedValue({
            success: false, error: 'bad backup'
        } as Awaited<ReturnType<SecurityService['restoreMasterKeyBackup']>>);

        await expect(authService.restoreMasterKeyBackup('bad-backup', 'passphrase')).rejects.toThrow();
    });
});
