import { Keyboard, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef } from 'react';

import {
    loadShortcutBindings,
    ShortcutActionId,
    shortcutBindingLabel,
} from '@/hooks/shortcutBindings';
import { useTranslation } from '@/i18n';

import './keyboard-shortcut-reference.css';

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
                className="tengra-shortcut-ref"
                role="dialog"
                aria-modal="true"
                aria-labelledby="shortcut-ref-title"
                onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }}
            >
                <div
                    ref={overlayRef}
                    className="tengra-shortcut-ref__modal"
                >
                    {/* Header */}
                    <div className="tengra-shortcut-ref__header">
                        <div className="tengra-shortcut-ref__header-left">
                            <Keyboard className="tengra-shortcut-ref__icon" aria-hidden="true" />
                            <div>
                                <h2 id="shortcut-ref-title" className="tengra-shortcut-ref__title">
                                    {t('shortcuts.title')}
                                </h2>
                                <p className="tengra-shortcut-ref__subtitle">
                                    {t('shortcutReference.description')}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="tengra-shortcut-ref__close-btn"
                            aria-label={t('shortcuts.close')}
                        >
                            <X className="tengra-shortcut-ref__close-icon" aria-hidden="true" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="tengra-shortcut-ref__content">
                        {CATEGORIES.map((category) => (
                            <div key={category.titleKey} className="tengra-shortcut-ref__category">
                                <h3 className="tengra-shortcut-ref__category-title">
                                    {t(category.titleKey)}
                                </h3>
                                <div className="tengra-shortcut-ref__category-list">
                                    {category.items.map((item) => {
                                        const keys = shortcutBindingLabel(bindings[item.id], isMac).split(' + ');
                                        return (
                                            <div
                                                key={item.id}
                                                className="tengra-shortcut-ref__item"
                                            >
                                                <span className="tengra-shortcut-ref__item-label">{t(item.labelKey)}</span>
                                                <div className="tengra-shortcut-ref__item-keys">
                                                    {keys.map((key, i) => (
                                                        <kbd
                                                            key={`${key}-${i}`}
                                                            className="tengra-shortcut-ref__kbd"
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
                    <div className="tengra-shortcut-ref__footer">
                        <p className="tengra-shortcut-ref__footer-text">{t('shortcuts.footer')}</p>
                    </div>
                </div>
            </div>
        );
    }
);

KeyboardShortcutReference.displayName = 'KeyboardShortcutReference';
