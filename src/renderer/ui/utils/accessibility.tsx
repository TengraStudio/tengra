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
 * Accessibility utilities for the Tengra application.
 * Provides hooks, components, and utilities for a11y compliance.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@/i18n';

/* Batch-02: Extracted Long Classes */
const C_ACCESSIBILITY_1 = "sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none";


// ============================================================================
// Types
// ============================================================================

export interface AccessibilitySettings {
    /** High contrast mode for improved visibility */
    highContrast: boolean;
    /** Reduced motion preference */
    reducedMotion: boolean;
    /** Screen reader announcements enabled */
    screenReaderAnnouncements: boolean;
    /** Focus indicators enhanced */
    enhancedFocusIndicators: boolean;
}

export interface AnnouncementOptions {
    /** Politeness level for screen readers */
    politeness?: 'polite' | 'assertive' | 'off';
    /** Clear announcement after delay (ms) */
    clearAfter?: number;
}

// ============================================================================
// Accessibility Settings Store
// ============================================================================

const A11Y_SETTINGS_KEY = 'tengra-a11y-settings';

const defaultSettings: AccessibilitySettings = {
    highContrast: false,
    reducedMotion: false,
    screenReaderAnnouncements: true,
    enhancedFocusIndicators: false,
};

function loadSettings(): AccessibilitySettings {
    try {
        const stored = localStorage.getItem(A11Y_SETTINGS_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return { ...defaultSettings, ...parsed };
        }
    } catch {
        // Ignore parse errors
    }

    // Check system preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersHighContrast = window.matchMedia('(prefers-contrast: more)').matches;

    return {
        ...defaultSettings,
        reducedMotion: prefersReducedMotion,
        highContrast: prefersHighContrast,
    };
}

function saveSettings(settings: AccessibilitySettings): void {
    try {
        localStorage.setItem(A11Y_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        // Ignore storage errors
    }
}

// Simple store for accessibility settings
let currentSettings = loadSettings();
const listeners = new Set<(settings: AccessibilitySettings) => void>();

function notifyListeners(): void {
    listeners.forEach(listener => listener(currentSettings));
}

export function getA11ySettings(): AccessibilitySettings {
    return currentSettings;
}

export function setA11ySettings(updates: Partial<AccessibilitySettings>): void {
    currentSettings = { ...currentSettings, ...updates };
    saveSettings(currentSettings);

    // Apply DOM changes
    const root = document.documentElement;

    if (updates.highContrast !== undefined) {
        root.classList.toggle('high-contrast', updates.highContrast);
        root.setAttribute('data-high-contrast', updates.highContrast ? 'true' : 'false');
    }

    if (updates.reducedMotion !== undefined) {
        root.classList.toggle('reduced-motion', updates.reducedMotion);
        root.setAttribute('data-reduced-motion', updates.reducedMotion ? 'true' : 'false');
    }

    if (updates.enhancedFocusIndicators !== undefined) {
        root.classList.toggle('enhanced-focus', updates.enhancedFocusIndicators);
        root.setAttribute('data-enhanced-focus', updates.enhancedFocusIndicators ? 'true' : 'false');
    }

    notifyListeners();
}

export function subscribeToA11ySettings(listener: (settings: AccessibilitySettings) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

// ============================================================================
// useA11ySettings Hook
// ============================================================================

export function useA11ySettings(): {
    settings: AccessibilitySettings;
    updateSettings: (updates: Partial<AccessibilitySettings>) => void;
    toggleHighContrast: () => void;
    toggleReducedMotion: () => void;
    toggleEnhancedFocus: () => void;
} {
    const [settings, setSettings] = useState(currentSettings);

    useEffect(() => {
        // Apply initial settings to DOM
        const root = document.documentElement;
        root.classList.toggle('high-contrast', currentSettings.highContrast);
        root.setAttribute('data-high-contrast', currentSettings.highContrast ? 'true' : 'false');
        root.classList.toggle('reduced-motion', currentSettings.reducedMotion);
        root.setAttribute('data-reduced-motion', currentSettings.reducedMotion ? 'true' : 'false');
        root.classList.toggle('enhanced-focus', currentSettings.enhancedFocusIndicators);
        root.setAttribute('data-enhanced-focus', currentSettings.enhancedFocusIndicators ? 'true' : 'false');

        return subscribeToA11ySettings(setSettings);
    }, []);

    const updateSettings = useCallback((updates: Partial<AccessibilitySettings>) => {
        setA11ySettings(updates);
    }, []);

    const toggleHighContrast = useCallback(() => {
        setA11ySettings({ highContrast: !currentSettings.highContrast });
    }, []);

    const toggleReducedMotion = useCallback(() => {
        setA11ySettings({ reducedMotion: !currentSettings.reducedMotion });
    }, []);

    const toggleEnhancedFocus = useCallback(() => {
        setA11ySettings({ enhancedFocusIndicators: !currentSettings.enhancedFocusIndicators });
    }, []);

    return {
        settings,
        updateSettings,
        toggleHighContrast,
        toggleReducedMotion,
        toggleEnhancedFocus,
    };
}

// ============================================================================
// Screen Reader Announcements
// ============================================================================

let announcementId = 0;

/**
 * Hook for making screen reader announcements.
 * Returns a function to announce messages to screen readers.
 */
export function useScreenReaderAnnounce(): (message: string, options?: AnnouncementOptions) => void {
    const settings = useA11ySettings().settings;

    return useCallback((message: string, options?: AnnouncementOptions) => {
        if (!settings.screenReaderAnnouncements) {
            return;
        }

        const politeness = options?.politeness ?? 'polite';
        const clearAfter = options?.clearAfter ?? 5000;

        // Create or get the announcement container
        let container = document.getElementById('sr-announcements');
        if (!container) {
            container = document.createElement('div');
            container.id = 'sr-announcements';
            container.className = 'sr-only';
            container.setAttribute('aria-live', 'polite');
            container.setAttribute('aria-atomic', 'true');
            document.body.appendChild(container);
        }

        // Update politeness if needed
        if (politeness !== 'off') {
            container.setAttribute('aria-live', politeness);
        }

        // Create a unique ID for this announcement
        const id = `announcement-${++announcementId}`;

        // Create the announcement element
        const announcement = document.createElement('span');
        announcement.id = id;
        announcement.textContent = message;

        // Clear previous announcements and add new one
        container.innerHTML = '';
        container.appendChild(announcement);

        // Clear after delay if specified
        if (clearAfter > 0) {
            setTimeout(() => {
                const el = document.getElementById(id);
                if (el) {
                    el.remove();
                }
            }, clearAfter);
        }
    }, [settings.screenReaderAnnouncements]);
}

// ============================================================================
// Focus Management
// ============================================================================

/**
 * Hook for managing focus trap within a container.
 * Useful for modals, dialogs, and other focus-contained components.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
    isActive: boolean
): React.RefObject<T | null> {
    const containerRef = useRef<T>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!isActive || !containerRef.current) {
            return;
        }

        // Store the previously focused element
        previousFocusRef.current = document.activeElement as HTMLElement;

        const container = containerRef.current;
        const focusableSelectors = [
            'button:not([disabled])',
            'a[href]',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
        ].join(', ');

        const getFocusableElements = (): HTMLElement[] => {
            return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
        };

        const handleKeyDown = (e: KeyboardEvent): void => {
            if (e.key !== 'Tab') {
                return;
            }

            const focusableElements = getFocusableElements();
            if (focusableElements.length === 0) {
                e.preventDefault();
                return;
            }

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        // Focus the first focusable element or the container
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        } else {
            container.setAttribute('tabindex', '-1');
            container.focus();
        }

        container.addEventListener('keydown', handleKeyDown);

        return () => {
            container.removeEventListener('keydown', handleKeyDown);

            // Restore focus to the previously focused element
            if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
                previousFocusRef.current.focus();
            }
        };
    }, [isActive]);

    return containerRef;
}

/**
 * Hook for tracking focus within a container.
 * Useful for implementing roving tabindex patterns.
 */
export function useRovingTabIndex<T extends HTMLElement = HTMLElement>(): {
    containerRef: React.RefObject<T | null>;
    focusedIndex: number;
    setFocusedIndex: (index: number) => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
} {
    const containerRef = useRef<T>(null);
    const [focusedIndex, setFocusedIndex] = useState(0);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!containerRef.current) {
            return;
        }

        const focusableSelectors = [
            'button:not([disabled])',
            'a[href]',
            'input:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
        ].join(', ');

        const items = Array.from(containerRef.current.querySelectorAll<HTMLElement>(focusableSelectors));

        switch (e.key) {
            case 'ArrowDown':
            case 'ArrowRight':
                e.preventDefault();
                setFocusedIndex(prev => {
                    const next = (prev + 1) % items.length;
                    items[next]?.focus();
                    return next;
                });
                break;
            case 'ArrowUp':
            case 'ArrowLeft':
                e.preventDefault();
                setFocusedIndex(prev => {
                    const next = prev === 0 ? items.length - 1 : prev - 1;
                    items[next]?.focus();
                    return next;
                });
                break;
            case 'Home':
                e.preventDefault();
                setFocusedIndex(0);
                items[0]?.focus();
                break;
            case 'End': {
                e.preventDefault();
                const lastIndex = items.length - 1;
                setFocusedIndex(lastIndex);
                items[lastIndex]?.focus();
                break;
            }
        }
    }, []);

    return {
        containerRef,
        focusedIndex,
        setFocusedIndex,
        handleKeyDown,
    };
}

// ============================================================================
// Keyboard Navigation Helpers
// ============================================================================

export interface KeyHandler {
    key: string;
    handler: (e: KeyboardEvent) => void;
    modifiers?: {
        ctrl?: boolean;
        shift?: boolean;
        alt?: boolean;
        meta?: boolean;
    };
}

/**
 * Hook for handling keyboard shortcuts.
 */
export function useKeyboardShortcuts(
    handlers: KeyHandler[],
    deps: React.DependencyList = []
): void {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
            for (const { key, handler, modifiers } of handlers) {
                if (e.key.toLowerCase() !== key.toLowerCase()) {
                    continue;
                }

                if (modifiers) {
                    if (modifiers.ctrl !== undefined && modifiers.ctrl !== e.ctrlKey) {
                        continue;
                    }
                    if (modifiers.shift !== undefined && modifiers.shift !== e.shiftKey) {
                        continue;
                    }
                    if (modifiers.alt !== undefined && modifiers.alt !== e.altKey) {
                        continue;
                    }
                    if (modifiers.meta !== undefined && modifiers.meta !== e.metaKey) {
                        continue;
                    }
                }

                handler(e);
                break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handlers, ...deps]);
}

// ============================================================================
// Accessibility Context Provider
// ============================================================================

interface AccessibilityContextValue {
    settings: AccessibilitySettings;
    updateSettings: (updates: Partial<AccessibilitySettings>) => void;
    announce: (message: string, options?: AnnouncementOptions) => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { settings, updateSettings } = useA11ySettings();
    const announce = useScreenReaderAnnounce();

    return (
        <AccessibilityContext.Provider value={{ settings, updateSettings, announce }}>
            {children}
        </AccessibilityContext.Provider>
    );
};

export function useAccessibility(): AccessibilityContextValue {
    const { t } = useTranslation();
    const context = useContext(AccessibilityContext);
    if (!context) {
        throw new Error(t('frontend.errors.context.useAccessibilityProvider'));
    }
    return context;
}

// ============================================================================
// Utility Components
// ============================================================================

/**
 * Visually hidden component for screen reader only content.
 */
export const VisuallyHidden: React.FC<{ children: React.ReactNode; as?: keyof JSX.IntrinsicElements }> = ({
    children,
    as: Component = 'span',
}) => {
    return (
        <Component className="sr-only">
            {children}
        </Component>
    );
};

/**
 * Skip link component for keyboard navigation.
 */
export const SkipLink: React.FC<{ targetId: string; label?: string }> = ({
    targetId,
    label,
}) => {
    const { t } = useTranslation();
    const resolvedLabel = label ?? t('frontend.settings.accessibility.skipToMainContent');

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        const target = document.getElementById(targetId);
        if (target) {
            target.setAttribute('tabindex', '-1');
            target.focus();
            target.removeAttribute('tabindex');
        }
    };

    return (
        <a
            href={`#${targetId}`}
            onClick={handleClick}
            className={C_ACCESSIBILITY_1}
        >
            {resolvedLabel}
        </a>
    );
};

/**
 * Live region component for dynamic content announcements.
 */
export const LiveRegion: React.FC<{
    children: React.ReactNode;
    politeness?: 'polite' | 'assertive' | 'off';
    atomic?: boolean;
    relevant?: 'additions' | 'removals' | 'text' | 'all' | 'additions text';
}> = ({
    children,
    politeness = 'polite',
    atomic = true,
    relevant = 'additions text',
}) => {
        return (
            <div
                aria-live={politeness}
                aria-atomic={atomic}
                aria-relevant={relevant}
                className="sr-only"
            >
                {children}
            </div>
        );
    };


