/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Keyboard, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef } from 'react';

import {
    loadShortcutBindings,
    ShortcutActionId,
    shortcutBindingLabel,
} from '@/hooks/shortcutBindings';
import { useTranslation } from '@/i18n';


interface ShortcutCategory {
    titleKey: string;
    items: ReadonlyArray<{ id: ShortcutActionId; labelKey: string }>;
}

const CATEGORIES: readonly ShortcutCategory[] = [
    {
        titleKey: 'shortcuts.general',
        items: [
            { id: 'newChat', labelKey: 'shortcuts.newChat' },
            { id: 'openSettings', labelKey: 'shortcuts.openSettings' },
            { id: 'toggleSidebar', labelKey: 'shortcuts.toggleSidebar' },
            { id: 'showShortcuts', labelKey: 'shortcuts.showShortcuts' },
        ],
    },
    {
        titleKey: 'shortcuts.navigation',
        items: [
            { id: 'goToChat', labelKey: 'shortcuts.goToChat' },
            { id: 'goToWorkspaces', labelKey: 'shortcuts.goToWorkspaces' },
            { id: 'goToSettings', labelKey: 'shortcuts.goToSettings' },
        ],
    },
    {
        titleKey: 'shortcuts.chat',
        items: [
            { id: 'clearChat', labelKey: 'shortcuts.clearChat' },
        ],
    },
] as const;

interface KeyboardShortcutReferenceProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Read-only keyboard shortcut reference overlay.
 * Displays all configured shortcuts grouped by category.
 */
export const KeyboardShortcutReference: React.FC<KeyboardShortcutReferenceProps> = React.memo(
    ({ isOpen, onClose }) => {
        const { t } = useTranslation();
        const overlayRef = useRef<HTMLDivElement>(null);
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

        const bindings = useMemo(() => (isOpen ? loadShortcutBindings() : null), [isOpen]);

        useEffect(() => {
            if (!isOpen) {
                return;
            }
            const handleKeyDown = (e: KeyboardEvent): void => {
                if (e.key === 'Escape') {
                    onClose();
                }
            };
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }, [isOpen, onClose]);

        if (!isOpen || !bindings) {
            return null;
        }

        return (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-background/60 backdrop-blur-4 animate-in fade-in duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="shortcut-ref-title"
                onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }}
            >
                <div
                    ref={overlayRef}
                    className="relative flex flex-col w-full max-w-2xl max-h-85vh bg-background border border-border/50 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 outline-none"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/10">
                        <div className="flex items-center gap-3">
                            <div className="flex justify-center items-center p-2 bg-primary/10 rounded-lg text-primary"><Keyboard className="w-5 h-5" aria-hidden="true" /></div>
                            <div>
                                <h2 id="shortcut-ref-title" className="text-lg font-bold text-foreground m-0">
                                    {t('shortcuts.title')}
                                </h2>
                                <p className="text-xs text-muted-foreground m-0 mt-0.5">
                                    {t('shortcutReference.description')}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-muted-foreground bg-transparent border-none rounded-lg cursor-pointer transition-colors hover:bg-muted hover:text-foreground"
                            aria-label={t('shortcuts.close')}
                        >
                            <X className="w-5 h-5" aria-hidden="true" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-background">
                        {CATEGORIES.map((category) => (
                            <div key={category.titleKey} className="space-y-3">
                                <h3 className="text-sm font-semibold text-primary/80 uppercase tracking-wider">
                                    {t(category.titleKey)}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {category.items.map((item) => {
                                        const keys = shortcutBindingLabel(bindings[item.id], isMac).split(' + ');
                                        return (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/40 transition-colors hover:bg-muted/40 hover:border-border/60"
                                            >
                                                <span className="font-medium text-foreground text-sm">{t(item.labelKey)}</span>
                                                <div className="flex items-center gap-2">
                                                    {keys.map((key, i) => (
                                                        <kbd
                                                            key={`${key}-${i}`}
                                                            className="inline-flex items-center justify-center h-7 px-2 font-mono text-xs font-semibold text-foreground bg-background border border-border/50 rounded shadow-sm min-w-7"
                                                        >
                                                            {key}
                                                        </kbd>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-border/50 bg-muted/10 text-center">
                        <p className="text-xs text-muted-foreground m-0">{t('shortcuts.footer')}</p>
                    </div>
                </div>
            </div>
        );
    }
);

KeyboardShortcutReference.displayName = 'KeyboardShortcutReference';
