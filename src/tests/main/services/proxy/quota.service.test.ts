
import { vi } from 'vitest'

// Mock Electron modules
vi.mock('electron', () => {
    return {
        net: {
            request: vi.fn(),
        },
        session: {
            defaultSession: {
                cookies: {
                    get: vi.fn(),
                },
            },
        },
        app: {
            getPath: vi.fn(),
        }
    }
})

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(),
        readdirSync: vi.fn(),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        mkdtempSync: vi.fn(),
        rmSync: vi.fn(),
        statSync: vi.fn(),
    },
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdtempSync: vi.fn(),
    rmSync: vi.fn(),
    statSync: vi.fn(),
}))

vi.mock('path', () => ({
    default: {
        join: (...args: string[]) => args.join('/'),
        dirname: (p: string) => p.substring(0, p.lastIndexOf('/')),
    },
    join: (...args: string[]) => args.join('/'),
    dirname: (p: string) => p.substring(0, p.lastIndexOf('/')),
}))

import { describe, it, expect } from 'vitest'
import { QuotaService } from '@main/services/proxy/quota.service'

const mockSettingsService = { getSettings: vi.fn(() => ({})) } as any
const mockDataService = { getPath: vi.fn() } as any
const mockSecurityService = { encryptSync: vi.fn(), decryptSync: vi.fn() } as any

describe('QuotaService', () => {
    const service = new QuotaService(mockSettingsService, mockDataService, mockSecurityService)

    it('should extract usage from wham data correctly', () => {
        const whamData = {
            total_requests: 100,
            requests_remaining: 50,
            rate_limit: {
                primary_window: {
                    used_percent: 50,
                    reset_at: 1234567890
                }
            }
        }

        const usage = service.extractCodexUsageFromWham(whamData)
        expect(usage).not.toBeNull()
        expect(usage!.totalRequests).toBe(100)
        expect(usage!.remainingRequests).toBe(50)
        expect(usage!.dailyUsedPercent).toBe(50)
        expect(usage!.dailyResetAt).toBe(new Date(1234567890 * 1000).toISOString())
    })

    it('should handle nested wham structures', () => {
        const whamData = {
            items: [
                {
                    something: {
                        limit_daily: 200,
                        usage_daily: 10
                    }
                }
            ]
        }

        const usage = service.extractCodexUsageFromWham(whamData)
        expect(usage).not.toBeNull()
        expect(usage!.dailyLimit).toBe(200)
        expect(usage!.dailyUsage).toBe(10)
    })

    it('should return null for empty/invalid data', () => {
        expect(service.extractCodexUsageFromWham({})).toBeNull()
        expect(service.extractCodexUsageFromWham(null)).toBeNull()
    })
})
