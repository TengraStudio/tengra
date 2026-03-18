import type { IpcValue } from '@shared/types/common';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import '@testing-library/jest-dom';

// Polyfill window.matchMedia for jsdom (required by accessibility.tsx at import time)
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock Electron IPC
type ElectronInvoke = <T = IpcValue>(channel: string, ...args: IpcValue[]) => Promise<T>;
type ElectronListener = (channel: string, listener: (...args: IpcValue[]) => void) => void;

interface TranslationOptions {
    defaultValue?: string;
    [key: string]: string | number | boolean | undefined;
}

declare global {
    interface Window {
        electronAPI: {
            invoke: ElectronInvoke
            on: ElectronListener
            off: ElectronListener
            once: ElectronListener
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
        t: (key: string, options?: TranslationOptions) => {
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
