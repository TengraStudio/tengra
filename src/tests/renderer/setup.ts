import '@testing-library/jest-dom'
import { beforeEach, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Mock Electron IPC
declare global {
    interface Window {
        electronAPI: {
            invoke: any
            on: any
            off: any
            once: any
        }
    }
}

global.window = global.window || ({} as any)
global.window.electronAPI = {
    // Mock common IPC methods
    invoke: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
}

// Mock i18n
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: any) => {
            if (options && typeof options === 'object' && 'defaultValue' in options) {
                return options.defaultValue
            }
            return key
        },
        i18n: { language: 'en' }
    }),
    Trans: ({ children }: { children: React.ReactNode }) => children,
}))

// Cleanup after each test
afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

// Reset mocks before each test  
beforeEach(() => {
    vi.clearAllMocks()
})