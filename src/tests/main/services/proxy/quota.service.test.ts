/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fs from 'fs';

import { LinkedAccount } from '@main/services/data/database.service';
import { QuotaError, QuotaErrorCode, QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { SettingsService } from '@main/services/system/settings.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs');
vi.mock('axios');
vi.mock('@main/logging/logger');

describe('QuotaService', () => {
    let quotaService: QuotaService;
    let mockSettingsService: SettingsService;
    let mockAuthService: AuthService;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSettingsService = {
            getSettings: vi.fn().mockReturnValue({
                proxy: {
                    codex: { organizationId: 'org-123' }
                }
            })
        } as never as SettingsService;

        mockAuthService = {
            getAllAccountsFull: vi.fn().mockResolvedValue([]),
            getAccountsByProviderFull: vi.fn().mockResolvedValue([]),
            updateToken: vi.fn().mockResolvedValue(undefined)
        } as never as AuthService;

        quotaService = new QuotaService(
            mockSettingsService as never as SettingsService,
            mockAuthService as never as AuthService
        );
    });

    describe('getQuota', () => {
        it('should return null if no accounts found', async () => {
            const result = await quotaService.getQuota(8080, 'key');
            expect(result).toBeNull();
        });

        it('should return results for antigravity accounts', async () => {
            const mockAccount: LinkedAccount = {
                id: 'acc-1',
                provider: 'antigravity-1',
                email: 'test@example.com',
                accessToken: 'token-123'
            } as LinkedAccount;

            vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([mockAccount]);

            // Mock handler behavior
            (quotaService as never as { antigravityHandler: { fetchAntigravityUpstreamForToken: ReturnType<typeof vi.fn> } })
                .antigravityHandler.fetchAntigravityUpstreamForToken = vi.fn().mockResolvedValue({
                    models: {
                        'gpt-4': { displayName: 'GPT-4', quotaInfo: { remainingQuota: 10, totalQuota: 100, remainingFraction: 0.1 } }
                    }
                });

            const result = await quotaService.getQuota(8080, 'key');
            expect(result).not.toBeNull();
            expect(result?.accounts).toHaveLength(1);
            expect(result?.accounts[0].email).toBe('test@example.com');
        });

        it('should preserve Antigravity AI Credits metadata per account and model', async () => {
            const mockAccount: LinkedAccount = {
                id: 'acc-credits',
                provider: 'google',
                email: 'credits@example.com',
                accessToken: 'token-credits'
            } as LinkedAccount;

            vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([mockAccount]);

            (quotaService as never as { antigravityHandler: { fetchAntigravityUpstreamForToken: ReturnType<typeof vi.fn> } })
                .antigravityHandler.fetchAntigravityUpstreamForToken = vi.fn().mockResolvedValue({
                    useAICredits: true,
                    creditAmount: 12,
                    minimumCreditAmountForUsage: 4,
                    models: {
                        'gemini-3.1-pro': {
                            displayName: 'Gemini 3.1 Pro',
                            quotaInfo: {
                                remainingQuota: 0,
                                totalQuota: 100,
                                remainingFraction: 0,
                            },
                            pricingType: 'STATIC_CREDIT',
                            useAICredits: true,
                            creditAmount: 12,
                            minimumCreditAmountForUsage: 4,
                        }
                    }
                });

            const result = await quotaService.getQuota(8080, 'key');
            expect(result?.accounts[0].antigravityAiCredits?.canUseCredits).toBe(true);
            expect(result?.accounts[0].models[0].quotaInfo?.aiCredits?.pricingType).toBe('STATIC_CREDIT');
            expect(result?.accounts[0].models[0].quotaInfo?.aiCredits?.creditAmount).toBe(12);
        });

        it('should read Antigravity AI Credits from loadCodeAssist paidTier payloads', async () => {
            const mockAccount: LinkedAccount = {
                id: 'acc-paid-tier',
                provider: 'antigravity',
                email: 'credits@example.com',
                accessToken: 'token-credits'
            } as LinkedAccount;

            vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([mockAccount]);

            (quotaService as never as { antigravityHandler: { fetchAntigravityUpstreamForToken: ReturnType<typeof vi.fn> } })
                .antigravityHandler.fetchAntigravityUpstreamForToken = vi.fn().mockResolvedValue({
                    paidTier: {
                        id: 'g1-pro-tier',
                        availableCredits: [
                            {
                                creditType: 'GOOGLE_ONE_AI',
                                creditAmount: '19',
                                minimumCreditAmountForUsage: '50',
                            }
                        ]
                    },
                    models: {
                        'gemini-3.1-flash-lite': {
                            displayName: 'Gemini 3.1 Flash Lite',
                            quotaInfo: {
                                remainingQuota: 100,
                                totalQuota: 100,
                                remainingFraction: 1,
                            }
                        }
                    }
                });

            const result = await quotaService.getQuota(8080, 'key');
            expect(result?.accounts[0].antigravityAiCredits?.creditAmount).toBe(19);
            expect(result?.accounts[0].antigravityAiCredits?.minimumCreditAmountForUsage).toBe(50);
            expect(result?.accounts[0].antigravityAiCredits?.canUseCredits).toBe(false);
        });

        it('should return null for negative port', async () => {
            const result = await quotaService.getQuota(-1, 'key');
            expect(result).toBeNull();
        });

        it('should return null for port zero', async () => {
            const result = await quotaService.getQuota(0, 'key');
            expect(result).toBeNull();
        });

        it('should return null for port above 65535', async () => {
            const result = await quotaService.getQuota(70000, 'key');
            expect(result).toBeNull();
        });

        it('should return null for NaN port', async () => {
            const result = await quotaService.getQuota(NaN, 'key');
            expect(result).toBeNull();
        });

        it('should return null for Infinity port', async () => {
            const result = await quotaService.getQuota(Infinity, 'key');
            expect(result).toBeNull();
        });

        it('should return null for fractional port', async () => {
            const result = await quotaService.getQuota(80.5, 'key');
            expect(result).toBeNull();
        });

        it('should return null for empty proxyKey', async () => {
            const result = await quotaService.getQuota(8080, '');
            expect(result).toBeNull();
        });

        it('should return null for whitespace-only proxyKey', async () => {
            const result = await quotaService.getQuota(8080, '   ');
            expect(result).toBeNull();
        });

        it('should return null for non-string proxyKey', async () => {
            const result = await quotaService.getQuota(8080, 123 as never as string);
            expect(result).toBeNull();
        });
    });

    describe('getCopilotQuota', () => {
        it('should return default structure if no token', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);
            const result = await quotaService.getCopilotQuota();
            expect(result.accounts).toHaveLength(0);
        });

        it('should deduplicate accounts with same email', async () => {
            const account1: LinkedAccount = {
                id: 'acc-1',
                provider: 'github',
                email: 'dupe@example.com',
                accessToken: 'token-1'
            } as LinkedAccount;

            const account2: LinkedAccount = {
                id: 'acc-2',
                provider: 'copilot',
                email: 'dupe@example.com',
                accessToken: 'token-2'
            } as LinkedAccount;

            vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([account1, account2]);

            (quotaService as never as { copilotHandler: { fetchCopilotQuotaForToken: ReturnType<typeof vi.fn> } })
                .copilotHandler.fetchCopilotQuotaForToken = vi.fn().mockResolvedValue({
                    chatEnabled: true,
                    codeCompletionEnabled: true
                });

            const result = await quotaService.getCopilotQuota();
            expect(result.accounts).toHaveLength(1);
            expect(result.accounts[0].email).toBe('dupe@example.com');
        });

        it('should prefer github provider when deduplicating', async () => {
            const githubAccount: LinkedAccount = {
                id: 'acc-1',
                provider: 'github',
                email: 'user@example.com',
                accessToken: 'token-1'
            } as LinkedAccount;

            const copilotAccount: LinkedAccount = {
                id: 'acc-2',
                provider: 'copilot',
                email: 'user@example.com',
                accessToken: 'token-2'
            } as LinkedAccount;

            vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([githubAccount, copilotAccount]);

            (quotaService as never as { copilotHandler: { fetchCopilotQuotaForToken: ReturnType<typeof vi.fn> } })
                .copilotHandler.fetchCopilotQuotaForToken = vi.fn().mockResolvedValue({
                    chatEnabled: true,
                    codeCompletionEnabled: true
                });

            const result = await quotaService.getCopilotQuota();
            expect(result.accounts).toHaveLength(1);
            expect(result.accounts[0].accountId).toBe('acc-1');
        });
    });

    describe('saveClaudeSession', () => {
        it('should reject empty sessionKey', async () => {
            const result = await quotaService.saveClaudeSession('');
            expect(result.success).toBe(false);
            expect(result.error).toContain('non-empty string');
        });

        it('should reject whitespace-only sessionKey', async () => {
            const result = await quotaService.saveClaudeSession('   ');
            expect(result.success).toBe(false);
            expect(result.error).toContain('non-empty string');
        });

        it('should reject non-string input', async () => {
            const result = await quotaService.saveClaudeSession(123 as never as string);
            expect(result.success).toBe(false);
            expect(result.error).toContain('non-empty string');
        });

        it('should reject empty accountId when provided', async () => {
            const result = await quotaService.saveClaudeSession('valid-key', '');
            expect(result.success).toBe(false);
            expect(result.error).toContain('accountId');
        });

        it('should reject whitespace-only accountId', async () => {
            const result = await quotaService.saveClaudeSession('valid-key', '   ');
            expect(result.success).toBe(false);
            expect(result.error).toContain('accountId');
        });

        it('should reject non-string accountId', async () => {
            const result = await quotaService.saveClaudeSession('valid-key', 42 as never as string);
            expect(result.success).toBe(false);
            expect(result.error).toContain('accountId');
        });
    });

    describe('QuotaErrorCode', () => {
        it('should have all expected error codes', () => {
            expect(QuotaErrorCode.INVALID_SESSION_KEY).toBe('QUOTA_INVALID_SESSION_KEY');
            expect(QuotaErrorCode.INVALID_INPUT).toBe('QUOTA_INVALID_INPUT');
            expect(QuotaErrorCode.FETCH_FAILED).toBe('QUOTA_FETCH_FAILED');
            expect(QuotaErrorCode.AUTH_EXPIRED).toBe('QUOTA_AUTH_EXPIRED');
            expect(QuotaErrorCode.NO_ACCOUNTS).toBe('QUOTA_NO_ACCOUNTS');
            expect(QuotaErrorCode.PARSE_FAILED).toBe('QUOTA_PARSE_FAILED');
        });

        it('should have quota exceeded error code', () => {
            expect(QuotaErrorCode.QUOTA_EXCEEDED).toBe('QUOTA_EXCEEDED');
        });

        it('should have refresh failed error code', () => {
            expect(QuotaErrorCode.REFRESH_FAILED).toBe('QUOTA_REFRESH_FAILED');
        });

        it('should have account locked error code', () => {
            expect(QuotaErrorCode.ACCOUNT_LOCKED).toBe('QUOTA_ACCOUNT_LOCKED');
        });
    });

    describe('QuotaError', () => {
        it('should create error with correct code and message', () => {
            const error = new QuotaError('Quota exceeded', QuotaErrorCode.QUOTA_EXCEEDED);
            expect(error.message).toBe('Quota exceeded');
            expect(error.quotaCode).toBe(QuotaErrorCode.QUOTA_EXCEEDED);
            expect(error.code).toBe('QUOTA_EXCEEDED');
            expect(error).toBeInstanceOf(Error);
        });

        it('should carry context on refresh failure', () => {
            const error = new QuotaError('Refresh failed', QuotaErrorCode.REFRESH_FAILED, { provider: 'antigravity' });
            expect(error.quotaCode).toBe(QuotaErrorCode.REFRESH_FAILED);
            expect(error.context).toEqual({ provider: 'antigravity' });
        });

        it('should carry context on account lock', () => {
            const error = new QuotaError('Account locked', QuotaErrorCode.ACCOUNT_LOCKED, { accountId: 'acc-1' });
            expect(error.quotaCode).toBe(QuotaErrorCode.ACCOUNT_LOCKED);
            expect(error.context).toEqual({ accountId: 'acc-1' });
        });

        it('should be instanceof QuotaError', () => {
            const error = new QuotaError('test', QuotaErrorCode.FETCH_FAILED);
            expect(error).toBeInstanceOf(QuotaError);
        });

        it('should have a timestamp', () => {
            const error = new QuotaError('test', QuotaErrorCode.AUTH_EXPIRED);
            expect(error.timestamp).toBeDefined();
            expect(typeof error.timestamp).toBe('string');
        });
    });

    describe('saveClaudeSession error codes', () => {
        it('should return INVALID_SESSION_KEY code for empty sessionKey', async () => {
            const result = await quotaService.saveClaudeSession('');
            expect(result.success).toBe(false);
            expect(result.code).toBe(QuotaErrorCode.INVALID_SESSION_KEY);
        });

        it('should return INVALID_INPUT code for invalid accountId', async () => {
            const result = await quotaService.saveClaudeSession('valid-key', '');
            expect(result.success).toBe(false);
            expect(result.code).toBe(QuotaErrorCode.INVALID_INPUT);
        });
    });

    describe('getQuota error codes', () => {
        it('should throw QuotaError with FETCH_FAILED on upstream failure', async () => {
            vi.mocked(mockAuthService.getAllAccountsFull).mockRejectedValue(new Error('network down'));
            await expect(quotaService.getQuota(8080, 'key')).rejects.toThrow(QuotaError);
            await expect(quotaService.getQuota(8080, 'key')).rejects.toMatchObject({
                quotaCode: QuotaErrorCode.FETCH_FAILED
            });
        });
    });

    describe('getQuota', () => {
        it('should return null when no antigravity accounts exist', async () => {
            vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([
                { id: 'acc-1', provider: 'codex', email: 'test@example.com', accessToken: 'tok' } as LinkedAccount
            ]);

            const result = await quotaService.getQuota(8080, 'key');
            expect(result).toBeNull();
        });
    });

    describe('fetchAntigravityQuota', () => {
        it('should return null when no antigravity accounts exist', async () => {
            vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([]);
            const result = await quotaService.fetchAntigravityQuota();
            expect(result).toBeNull();
        });

        it('should return null when only non-antigravity accounts exist', async () => {
            vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([
                { id: 'acc-1', provider: 'codex', email: 'test@example.com', accessToken: 'tok' } as LinkedAccount
            ]);
            const result = await quotaService.fetchAntigravityQuota();
            expect(result).toBeNull();
        });
    });

    describe('fetchAntigravityUpstreamForToken', () => {
        it('should return null for null account', async () => {
            const result = await quotaService.fetchAntigravityUpstreamForToken(null as never as LinkedAccount);
            expect(result).toBeNull();
        });

        it('should return null for undefined account', async () => {
            const result = await quotaService.fetchAntigravityUpstreamForToken(undefined as never as LinkedAccount);
            expect(result).toBeNull();
        });

        it('should return null for account missing id', async () => {
            const result = await quotaService.fetchAntigravityUpstreamForToken({ provider: 'antigravity' } as never as LinkedAccount);
            expect(result).toBeNull();
        });

        it('should return null for account missing provider', async () => {
            const result = await quotaService.fetchAntigravityUpstreamForToken({ id: 'acc-1' } as never as LinkedAccount);
            expect(result).toBeNull();
        });

        it('should return null for account with empty string id', async () => {
            const result = await quotaService.fetchAntigravityUpstreamForToken({ id: '', provider: 'antigravity' } as never as LinkedAccount);
            expect(result).toBeNull();
        });

        it('should return null for non-object account', async () => {
            const result = await quotaService.fetchAntigravityUpstreamForToken('not-an-object' as never as LinkedAccount);
            expect(result).toBeNull();
        });
    });

    describe('extractCodexUsageFromWham', () => {
        it('should return null for null data', () => {
            const result = quotaService.extractCodexUsageFromWham(null);
            expect(result).toBeNull();
        });

        it('should return null for undefined data', () => {
            const result = quotaService.extractCodexUsageFromWham(undefined as never as null);
            expect(result).toBeNull();
        });

        it('should return null for string data', () => {
            const result = quotaService.extractCodexUsageFromWham('not-an-object');
            expect(result).toBeNull();
        });

        it('should return null for number data', () => {
            const result = quotaService.extractCodexUsageFromWham(42);
            expect(result).toBeNull();
        });

        it('should return null for boolean data', () => {
            const result = quotaService.extractCodexUsageFromWham(true);
            expect(result).toBeNull();
        });

        it('should return object with null fields for empty object with no usage keys', () => {
            const result = quotaService.extractCodexUsageFromWham({});
            expect(result).not.toBeNull();
        });
    });

    describe('deduplicateCopilotAccounts edge cases', () => {
        it('should handle non-array input gracefully', () => {
            const dedup = (quotaService as never as { deduplicateCopilotAccounts: (a: TestValue) => LinkedAccount[] })
                .deduplicateCopilotAccounts;
            expect(dedup.call(quotaService, null)).toEqual([]);
            expect(dedup.call(quotaService, undefined)).toEqual([]);
            expect(dedup.call(quotaService, 'not-array')).toEqual([]);
        });

        it('should return empty for empty array', () => {
            const dedup = (quotaService as never as { deduplicateCopilotAccounts: (a: LinkedAccount[]) => LinkedAccount[] })
                .deduplicateCopilotAccounts;
            expect(dedup.call(quotaService, [])).toEqual([]);
        });

        it('should return single account directly without dedup', () => {
            const dedup = (quotaService as never as { deduplicateCopilotAccounts: (a: LinkedAccount[]) => LinkedAccount[] })
                .deduplicateCopilotAccounts;
            const single = [{ id: 'a1', provider: 'github', email: 'u@x.com', accessToken: 'tok' } as LinkedAccount];
            expect(dedup.call(quotaService, single)).toHaveLength(1);
        });

        it('should skip accounts with no email and no token', () => {
            const dedup = (quotaService as never as { deduplicateCopilotAccounts: (a: LinkedAccount[]) => LinkedAccount[] })
                .deduplicateCopilotAccounts;
            const accs = [{ id: 'a1', provider: 'github' } as LinkedAccount];
            expect(dedup.call(quotaService, accs)).toEqual([]);
        });
    });

    describe('getLegacyQuota', () => {
        it('should return success false when codex handler returns null', async () => {
            (quotaService as never as { codexHandler: { fetchCodexUsage: ReturnType<typeof vi.fn> } })
                .codexHandler.fetchCodexUsage = vi.fn().mockResolvedValue(null);
            const result = await quotaService.getLegacyQuota();
            expect(result.success).toBe(false);
        });

        it('should return success true with quota data', async () => {
            const mockUsage = { rate_limit: { primary_window: { used_percent: 0.25 } } };
            (quotaService as never as { codexHandler: { fetchCodexUsage: ReturnType<typeof vi.fn>; parseCodexUsageToQuota: ReturnType<typeof vi.fn> } })
                .codexHandler.fetchCodexUsage = vi.fn().mockResolvedValue(mockUsage);
            (quotaService as never as { codexHandler: { parseCodexUsageToQuota: ReturnType<typeof vi.fn> } })
                .codexHandler.parseCodexUsageToQuota = vi.fn().mockReturnValue({ status: 'ok', models: [] });
            const result = await quotaService.getLegacyQuota();
            expect(result.success).toBe(true);
        });
    });

    describe('getAntigravityAvailableModels', () => {
        it('should return empty array when no antigravity accounts', async () => {
            vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([]);
            const result = await quotaService.getAntigravityAvailableModels();
            expect(result).toEqual([]);
        });

        it('should return empty array when handler returns null', async () => {
            vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([
                { id: 'a1', provider: 'antigravity-1', email: 'e@x.com', accessToken: 'tok' } as LinkedAccount
            ]);
            (quotaService as never as { antigravityHandler: { fetchAntigravityUpstreamForToken: ReturnType<typeof vi.fn> } })
                .antigravityHandler.fetchAntigravityUpstreamForToken = vi.fn().mockResolvedValue(null);
            const result = await quotaService.getAntigravityAvailableModels();
            expect(result).toEqual([]);
        });
    });

    describe('performance budget instrumentation', () => {
        it('should not warn when operations complete quickly', async () => {
            const { appLogger: mockLogger } = await import('@main/logging/logger');
            vi.mocked(mockLogger.warn).mockClear();
            vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([]);
            await quotaService.getQuota(8080, 'key');
            const budgetWarnings = vi.mocked(mockLogger.warn).mock.calls.filter(
                (c) => typeof c[1] === 'string' && c[1].includes('exceeded budget')
            );
            expect(budgetWarnings).toHaveLength(0);
        });
    });
});
