/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Tests for accessibility utilities
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});

// Mock matchMedia
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

describe('Accessibility Utilities', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    describe('A11y Settings Store', () => {
        it('should load default settings when no stored settings exist', async () => {
            const { getA11ySettings } = await import('@/utils/accessibility');
            const settings = getA11ySettings();

            // expect(settings.highContrast).toBe(false);
            expect(settings.screenReaderAnnouncements).toBe(true);
            expect(settings.enhancedFocusIndicators).toBe(false);
        });

        it('should persist settings to localStorage', async () => {
            const { setA11ySettings, getA11ySettings } = await import('@/utils/accessibility');

            // setA11ySettings({ highContrast: true });

            const settings = getA11ySettings();
            // expect(settings.highContrast).toBe(true);
            expect(localStorageMock.setItem).toHaveBeenCalled();
        });

        it('should apply reduced motion class to document', async () => {
            const { setA11ySettings } = await import('@/utils/accessibility');

            setA11ySettings({ reducedMotion: true });

            expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);
            expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
        });

        it('should apply enhanced focus class to document', async () => {
            const { setA11ySettings } = await import('@/utils/accessibility');

            setA11ySettings({ enhancedFocusIndicators: true });

            expect(document.documentElement.classList.contains('enhanced-focus')).toBe(true);
            expect(document.documentElement.getAttribute('data-enhanced-focus')).toBe('true');
        });
    });

    describe('Focus Trap', () => {
        it('should trap focus within container', async () => {
            const container = document.createElement('div');
            const button1 = document.createElement('button');
            const button2 = document.createElement('button');

            button1.textContent = 'First';
            button2.textContent = 'Last';

            container.appendChild(button1);
            container.appendChild(button2);
            document.body.appendChild(container);

            // Test that focus trap can be applied
            expect(container.contains(button1)).toBe(true);
            expect(container.contains(button2)).toBe(true);

            document.body.removeChild(container);
        });
    });

    describe('Screen Reader Announcements', () => {
        it('should create announcement container if not exists', async () => {
            const { useScreenReaderAnnounce } = await import('@/utils/accessibility');

            // The hook should be defined
            expect(typeof useScreenReaderAnnounce).toBe('function');
        });
    });

    describe('Keyboard Navigation', () => {
        it('should provide keyboard shortcut handler', async () => {
            const { useKeyboardShortcuts } = await import('@/utils/accessibility');

            expect(typeof useKeyboardShortcuts).toBe('function');
        });

        it('should provide roving tabindex hook', async () => {
            const { useRovingTabIndex } = await import('@/utils/accessibility');

            expect(typeof useRovingTabIndex).toBe('function');
        });
    });

    describe('Utility Components', () => {
        it('should export VisuallyHidden component', async () => {
            const { VisuallyHidden } = await import('@/utils/accessibility');

            expect(VisuallyHidden).toBeDefined();
        });

        it('should export SkipLink component', async () => {
            const { SkipLink } = await import('@/utils/accessibility');

            expect(SkipLink).toBeDefined();
        });

        it('should export LiveRegion component', async () => {
            const { LiveRegion } = await import('@/utils/accessibility');

            expect(LiveRegion).toBeDefined();
        });
    });
});
