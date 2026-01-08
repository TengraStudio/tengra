import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OllamaService } from '../../services/llm/ollama.service'
import { SettingsService } from '../../services/settings.service'

// We will mock settings store but keep service logic real
const initialSettings = {
    ollama: {
        url: 'http://custom-host:1234',
        model: 'llama2'
    }
}



// Mock fs to control SettingsService.loadSettings
vi.mock('fs', () => {
    return {
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(() => JSON.stringify(initialSettings)),
        writeFileSync: vi.fn()
    }
})

vi.mock('electron', () => ({
    app: { getPath: () => '/tmp' },
    ipcMain: { handle: vi.fn(), on: vi.fn() }
}))


describe('LLM-Settings Integration', () => {
    let settingsService: SettingsService
    let ollamaService: OllamaService

    beforeEach(() => {
        settingsService = new SettingsService()
        // We need to verify OllamaService reads from SettingsService
        ollamaService = new OllamaService(settingsService)
    })

    it('should initialize OllamaService with URL from settings', () => {
        // Since `host` and `port` are private, we can either access them with (any) 
        // or check public behavior if available.
        // OllamaService doesn't seem to expose host/port publicly.
        // But we can check via reflection for this test.

        const serviceAny = ollamaService as any
        expect(serviceAny.host).toBe('custom-host')
        expect(serviceAny.port).toBe(1234)
    })

    // If OllamaService supported dynamic updates (it might not yet, typically re-instantiated), 
    // we would test that here. But constructor reading is the key integration point.
})
