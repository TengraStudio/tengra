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
            { id: 'commandPalette', labelKey: 'shortcuts.commandPalette' },
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
                className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="shortcut-ref-title"
                onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }}
            >
                <div
                    ref={overlayRef}
                    className="w-full max-w-screen-lg bg-card border border-border/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                >
                    {/* Header */}
                    <div className="h-14 border-b border-border/50 flex items-center justify-between px-6 bg-muted/20">
                        <div className="flex items-center gap-2">
                            <Keyboard className="w-5 h-5 text-primary" aria-hidden="true" />
                            <div>
                                <h2 id="shortcut-ref-title" className="text-lg font-medium text-foreground">
                                    {t('shortcuts.title')}
                                </h2>
                                <p className="text-xxs text-muted-foreground/60">
                                    {t('shortcutReference.description')}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-muted/30 rounded-lg transition-colors text-muted-foreground/60 hover:text-foreground"
                            aria-label={t('shortcuts.close')}
                        >
                            <X className="w-5 h-5" aria-hidden="true" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-5 overflow-y-auto max-h-screen">
                        {CATEGORIES.map((category) => (
                            <div key={category.titleKey}>
                                <h3 className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest mb-2 px-1">
                                    {t(category.titleKey)}
                                </h3>
                                <div className="bg-muted/20 rounded-xl px-4 border border-border/50">
                                    {category.items.map((item) => {
                                        const keys = shortcutBindingLabel(bindings[item.id], isMac).split(' + ');
                                        return (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                                            >
                                                <span className="text-sm text-muted-foreground/70">{t(item.labelKey)}</span>
                                                <div className="flex items-center gap-1.5">
                                                    {keys.map((key, i) => (
                                                        <kbd
                                                            key={`${key}-${i}`}
                                                            className="px-2 py-1 bg-muted/50 border border-border/50 rounded text-xxs font-mono text-muted-foreground/80 min-w-6 text-center shadow-sm"
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
                    <div className="p-4 bg-muted/20 border-t border-border/50 text-center">
                        <p className="text-xxs text-muted-foreground/40">{t('shortcuts.footer')}</p>
                    </div>
                </div>
            </div>
        );
    }
);

KeyboardShortcutReference.displayName = 'KeyboardShortcutReference';
