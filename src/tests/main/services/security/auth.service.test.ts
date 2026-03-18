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

    it('warms linked account cache on initialize and serves provider reads without hitting the DB again', async () => {
        const account = makeAccount();
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([account]);

        await authService.initialize();
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockClear();

        const accounts = await authService.getAccountsByProvider('github');

        expect(accounts).toHaveLength(1);
        expect(accounts[0]?.id).toBe(account.id);
        expect(mockDatabaseService.getLinkedAccounts).not.toHaveBeenCalled();
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
