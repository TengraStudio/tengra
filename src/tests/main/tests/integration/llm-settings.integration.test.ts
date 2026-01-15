import { OllamaService } from '@main/services/llm/ollama.service'
import { SettingsService } from '@main/services/system/settings.service'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock fs to control SettingsService.loadSettings
vi.mock('fs', () => {
    const initialSettings = {
        ollama: {
            url: 'http://custom-host:1234',
            model: 'llama2'
        }
    }
    const mockFs = {
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(() => JSON.stringify(initialSettings)),
        writeFileSync: vi.fn(),
        promises: {
            access: vi.fn().mockResolvedValue(undefined),
            readFile: vi.fn().mockResolvedValue(JSON.stringify(initialSettings)),
            writeFile: vi.fn().mockResolvedValue(undefined)
        }
    }
    return mockFs
})

vi.mock('electron', () => ({
    app: { getPath: () => '/tmp' },
    ipcMain: { handle: vi.fn(), on: vi.fn() }
}))


describe('LLM-Settings Integration', () => {
    let settingsService: SettingsService
    let ollamaService: OllamaService

    beforeEach(async () => {
        settingsService = new SettingsService()
        await settingsService.initialize()
        // We need to verify OllamaService reads from SettingsService
        ollamaService = new OllamaService(settingsService)
    })

    it('should initialize OllamaService with URL from settings', () => {
        // Since `host` and `port` are private, we can either access them with (any) 
        // or check public behavior if available.
        // OllamaService doesn't seem to expose host/port publicly.
        // But we can check via reflection for this test.

        const serviceRef = ollamaService as unknown as { host: string; port: number }
        expect(serviceRef.host).toBe('custom-host')
        expect(serviceRef.port).toBe(1234)
    })

    // If OllamaService supported dynamic updates (it might not yet, typically re-instantiated), 
    // we would test that here. But constructor reading is the key integration point.
})
