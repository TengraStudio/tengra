import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import '@testing-library/jest-dom';

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

Object.defineProperty(window, 'electronAPI', {
    value: {
        invoke: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
    },
    configurable: true,
    writable: true,
});

// Mock i18n
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: any) => {
            if (options && typeof options === 'object' && 'defaultValue' in options) {
                return options.defaultValue;
            }
            return key;
        },
        i18n: { language: 'en' }
    }),
    Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Cleanup after each test
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

// Reset mocks before each test  
beforeEach(() => {
    vi.clearAllMocks();
    window.electronAPI = {
        invoke: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
    };
});
