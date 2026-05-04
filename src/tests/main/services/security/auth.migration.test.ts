/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */


import { DatabaseService } from '@main/services/data/database.service';
import { AuthService } from '@main/services/security/auth.service';
import { SecurityService } from '@main/services/security/security.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
    }
}));

vi.mock('fs', () => ({
    existsSync: vi.fn().mockReturnValue(false),
    promises: {
        readdir: vi.fn().mockResolvedValue([]),
        readFile: vi.fn(),
        unlink: vi.fn(),
    },
    mkdirSync: vi.fn(),
}));

describe('AuthService (New Multi-Account System)', () => {
    let mockSecurityService: SecurityService;
    let mockDatabaseService: DatabaseService;
    let mockEventBusService: EventBusService;
    let authService: AuthService;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSecurityService = {
            encryptSync: vi.fn((text) => `encrypted_${text}`),
            decryptSync: vi.fn((text) => text?.replace('encrypted_', ''))
        } as never as SecurityService;

        mockDatabaseService = {
            initialize: vi.fn().mockResolvedValue(undefined),
            getLinkedAccounts: vi.fn().mockResolvedValue([]),
            getActiveLinkedAccount: vi.fn().mockResolvedValue(null),
            saveLinkedAccount: vi.fn().mockResolvedValue(undefined),
            deleteLinkedAccount: vi.fn().mockResolvedValue(undefined),
            setActiveLinkedAccount: vi.fn().mockResolvedValue(undefined),
        } as never as DatabaseService;

        mockEventBusService = {
            emit: vi.fn()
        } as never as EventBusService;

        authService = new AuthService(
            mockDatabaseService,
            mockSecurityService,
            mockEventBusService,
            { setGithubToken: vi.fn() } as any,
            () => null
        );
    });

    describe('Initialization', () => {
        it('should initialize with database service', async () => {
            await authService.initialize();
            expect(mockDatabaseService.initialize).toHaveBeenCalled();
        });
    });

    describe('Linked Accounts', () => {
        it('should get accounts by provider', async () => {
            const mockAccounts = [
                { id: '1', provider: 'github', email: 'user@test.com', isActive: true, createdAt: Date.now(), updatedAt: Date.now() }
            ];
            vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue(mockAccounts);

            const accounts = await authService.getAccountsByProvider('github');

            expect(mockDatabaseService.getLinkedAccounts).toHaveBeenCalledWith();
            expect(accounts).toHaveLength(1);
            expect(accounts[0]?.provider).toBe('github');
        });

        it('should normalize provider names', async () => {
             const mockAccounts = [
                { id: '1', provider: 'claude', isActive: true, createdAt: Date.now(), updatedAt: Date.now() },
                { id: '2', provider: 'codex', isActive: true, createdAt: Date.now(), updatedAt: Date.now() }
            ];
            vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue(mockAccounts);

            const anthropicAccounts = await authService.getAccountsByProvider('anthropic');
            expect(anthropicAccounts).toHaveLength(1);
            expect(anthropicAccounts[0]?.provider).toBe('claude');

            // Note: openai now normalizes to codex
            const openaiAccounts = await authService.getAccountsByProvider('openai');
            expect(openaiAccounts).toHaveLength(1);
            expect(openaiAccounts[0]?.provider).toBe('codex');
        });

        it('should link new account', async () => {
            const tokenData = {
                accessToken: 'test-token',
                email: 'user@test.com'
            };

            await authService.linkAccount('github', tokenData);

            expect(mockDatabaseService.saveLinkedAccount).toHaveBeenCalledWith(
                expect.objectContaining({
                    provider: 'github',
                    email: 'user@test.com',
                    accessToken: 'encrypted_test-token',
                    isActive: true  // First account is active
                })
            );
        });

        it('should unlink account', async () => {
            const mockAccounts = [
                { id: '1', provider: 'github', isActive: true, createdAt: Date.now(), updatedAt: Date.now() }
            ];
            vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue(mockAccounts);

            await authService.unlinkAccount('1');

            expect(mockDatabaseService.deleteLinkedAccount).toHaveBeenCalledWith('1');
        });
    });

    describe('Token Access', () => {
        it('should provide getAllAccountsFull', async () => {
            const mockAccounts = [
                { id: '1', provider: 'github', email: 'user@test.com', accessToken: 'encrypted_token', isActive: true, createdAt: Date.now(), updatedAt: Date.now() }
            ];
            vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue(mockAccounts);

            const accounts = await authService.getAllAccountsFull();

            expect(accounts).toHaveLength(1);
            expect(accounts[0]?.provider).toBe('github');
            expect(accounts[0]?.accessToken).toBe('token'); // Decrypted
        });

        it('should provide getActiveToken', async () => {
            const mockAccount = {
                id: '1',
                provider: 'github',
                accessToken: 'encrypted_token',
                isActive: true,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            vi.mocked(mockDatabaseService.getActiveLinkedAccount).mockResolvedValue(mockAccount);

            const token = await authService.getActiveToken('github');

            expect(token).toBe('token'); // Decrypted
        });
    });
});
