import { Download, Keyboard, RotateCcw, Search, Upload, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
    DEFAULT_SHORTCUT_BINDINGS,
    eventToShortcutBinding,
    loadShortcutBindings,
    mergeShortcutBindings,
    resetShortcutBindings,
    saveShortcutBindings,
    ShortcutActionId,
    shortcutBindingLabel,
} from '@/hooks/shortcutBindings';
import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';


/**
 * Get all focusable elements within a container.
 */
const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
    const focusableSelectors = [
        'button:not([disabled])',
        'a[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
};

interface ShortcutItemProps {
    label: string;
    keys: string[];
    onCapture?: () => void;
    onReset?: () => void;
    isRecording?: boolean;
}

const ShortcutItem: React.FC<ShortcutItemProps> = ({
    label,
    keys,
    onCapture,
    onReset,
    isRecording,
}) => {
    const { t } = useTranslation();
    return (
        <div className="tengra-shortcuts-modal__item">
            <span className="tengra-shortcuts-modal__item-label">{label}</span>
            <div className="tengra-shortcuts-modal__item-controls">
                {keys.map((key, i) => (
                    <kbd key={`${key}-${i}`} className="tengra-shortcuts-modal__kbd">
                        {key}
                    </kbd>
                ))}
                {onCapture && (
                    <button
                        onClick={onCapture}
                        className={cn(
                            'tengra-shortcuts-modal__edit-btn',
                            isRecording && 'tengra-shortcuts-modal__edit-btn--recording'
                        )}
                    >
                        {isRecording ? t('shortcuts.pressKeys') : t('common.edit')}
                    </button>
                )}
                {onReset && (
                    <button
                        onClick={onReset}
                        className="tengra-shortcuts-modal__reset-btn"
                        title={t('shortcuts.resetToDefault')}
                    >
                        {t('common.reset')}
                    </button>
                )}
            </div>
        </div>
    );
};

interface KeyboardShortcutsModalProps {
    isOpen: boolean
    onClose: () => void
    language?: Language
}

interface ShortcutDefinition {
    id: ShortcutActionId;
    category: 'general' | 'navigation' | 'chat';
    labelKey: string;
}

const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
    { id: 'commandPalette', category: 'general', labelKey: 'shortcuts.commandPalette' },
    { id: 'newChat', category: 'general', labelKey: 'shortcuts.newChat' },
    { id: 'openSettings', category: 'general', labelKey: 'shortcuts.openSettings' },
    { id: 'toggleSidebar', category: 'general', labelKey: 'shortcuts.toggleSidebar' },
    { id: 'showShortcuts', category: 'general', labelKey: 'shortcuts.showShortcuts' },
    { id: 'goToChat', category: 'navigation', labelKey: 'shortcuts.goToChat' },
    { id: 'goToWorkspaces', category: 'navigation', labelKey: 'shortcuts.goToWorkspaces' },
    { id: 'goToSettings', category: 'navigation', labelKey: 'shortcuts.goToSettings' },
    { id: 'clearChat', category: 'chat', labelKey: 'shortcuts.clearChat' },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = React.memo(({ isOpen, onClose, language = 'en' }) => {
    const { t } = useTranslation(language);
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const importInputRef = useRef<HTMLInputElement>(null);
    const previousActiveElementRef = useRef<HTMLElement | null>(null);
    const [bindings, setBindings] = useState(loadShortcutBindings);
    const [searchTerm, setSearchTerm] = useState('');
    const [recordingAction, setRecordingAction] = useState<ShortcutActionId | null>(null);
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (isOpen) {
            setBindings(loadShortcutBindings());
        }
        setRecordingAction(null);
    }

    useEffect(() => {
        if (!isOpen) { return; }

        // Save the previously focused element
        previousActiveElementRef.current = document.activeElement as HTMLElement;

        // Focus the close button when modal opens
        if (closeButtonRef.current) {
            setTimeout(() => closeButtonRef.current?.focus(), 50);
        }

        // Handle Escape key to close modal
        const handleEscape = (e: KeyboardEvent) => {
            if (recordingAction) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    setRecordingAction(null);
                }
                return;
            }

            if (e.key === 'Escape') {
                onClose();
            }
        };

        const handleRecordShortcut = (e: KeyboardEvent) => {
            if (!recordingAction) {
                return;
            }
            e.preventDefault();
            const nextBinding = eventToShortcutBinding(e);
            if (!nextBinding) {
                return;
            }
            const next = {
                ...bindings,
                [recordingAction]: nextBinding,
            };
            setBindings(next);
            saveShortcutBindings(next);
            setRecordingAction(null);
        };

        // Handle Tab key to trap focus
        const handleTab = (e: KeyboardEvent) => {
            if (!modalRef.current || e.key !== 'Tab') { return; }

            const focusableElements = getFocusableElements(modalRef.current);
            if (focusableElements.length === 0) { return; }

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

        // Lock body scroll when modal is open
        document.body.style.overflow = 'hidden';

        document.addEventListener('keydown', handleEscape);
        document.addEventListener('keydown', handleTab);
        document.addEventListener('keydown', handleRecordShortcut);

        return () => {
            document.body.style.overflow = '';
            document.removeEventListener('keydown', handleEscape);
            document.removeEventListener('keydown', handleTab);
            document.removeEventListener('keydown', handleRecordShortcut);

            // Restore focus to the previously focused element
            if (previousActiveElementRef.current) {
                previousActiveElementRef.current.focus();
            }
        };
    }, [isOpen, onClose, bindings, recordingAction]);

    const visibleShortcuts = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) {
            return SHORTCUT_DEFINITIONS;
        }
        return SHORTCUT_DEFINITIONS.filter(def =>
            t(def.labelKey).toLowerCase().includes(query) ||
            shortcutBindingLabel(bindings[def.id], isMac).toLowerCase().includes(query)
        );
    }, [searchTerm, bindings, isMac, t]);

    const grouped = useMemo(() => {
        return {
            general: visibleShortcuts.filter(item => item.category === 'general'),
            navigation: visibleShortcuts.filter(item => item.category === 'navigation'),
            chat: visibleShortcuts.filter(item => item.category === 'chat'),
        };
    }, [visibleShortcuts]);

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) {
            return;
        }

        void (async () => {
            try {
                const text = await file.text();
                const imported = mergeShortcutBindings(JSON.parse(text));
                setBindings(imported);
                saveShortcutBindings(imported);
            } catch {
                // Ignore malformed imports silently.
            }
        })();
    };

    const handleExport = () => {
        const blob = new Blob([JSON.stringify(bindings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'keyboard-shortcuts.json';
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const handleResetAll = () => {
        const defaults = resetShortcutBindings();
        setBindings(defaults);
        setRecordingAction(null);
    };

    const handleResetOne = (id: ShortcutActionId) => {
        const next = {
            ...bindings,
            [id]: DEFAULT_SHORTCUT_BINDINGS[id],
        };
        setBindings(next);
        saveShortcutBindings(next);
        if (recordingAction === id) {
            setRecordingAction(null);
        }
    };

    if (!isOpen) { return null; }

    return (
        <div
            className="tengra-shortcuts-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-modal-title"
        >
            <div
                ref={modalRef}
                tabIndex={-1}
                className="tengra-shortcuts-modal__dialog"
            >
                <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json"
                    onChange={handleImport}
                    className="hidden"
                />

                {/* Header */}
                <div className="tengra-shortcuts-modal__header">
                    <div className="tengra-shortcuts-modal__header-left">
                        <Keyboard className="tengra-shortcuts-modal__icon" aria-hidden="true" />
                        <h2 id="shortcuts-modal-title" className="tengra-shortcuts-modal__title">{t('shortcuts.title')}</h2>
                    </div>
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        className="tengra-shortcuts-modal__close-btn"
                        aria-label={t('shortcuts.close')}
                    >
                        <X className="tengra-shortcuts-modal__close-icon" aria-hidden="true" />
                    </button>
                </div>

                <div className="tengra-shortcuts-modal__toolbar">
                    <div className="tengra-shortcuts-modal__search">
                        <Search className="tengra-shortcuts-modal__search-icon" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder={t('shortcuts.searchPlaceholder')}
                            className="tengra-shortcuts-modal__search-input"
                        />
                    </div>
                    <button
                        onClick={handleExport}
                        className="tengra-shortcuts-modal__toolbar-btn"
                    >
                        <Download className="tengra-shortcuts-modal__toolbar-btn-icon" /> {t('shortcuts.export')}
                    </button>
                    <button
                        onClick={() => importInputRef.current?.click()}
                        className="tengra-shortcuts-modal__toolbar-btn"
                    >
                        <Upload className="tengra-shortcuts-modal__toolbar-btn-icon" /> {t('shortcuts.import')}
                    </button>
                    <button
                        onClick={handleResetAll}
                        className="tengra-shortcuts-modal__toolbar-btn"
                    >
                        <RotateCcw className="tengra-shortcuts-modal__toolbar-btn-icon" /> {t('shortcuts.resetAll')}
                    </button>
                </div>

                {/* Content */}
                <div className="tengra-shortcuts-modal__content">
                    <div className="tengra-shortcuts-modal__category">
                        <h3 className="tengra-shortcuts-modal__category-title">{t('shortcuts.general')}</h3>
                        <div className="tengra-shortcuts-modal__category-list">
                            {grouped.general.map(def => (
                                <ShortcutItem
                                    key={def.id}
                                    label={t(def.labelKey)}
                                    keys={shortcutBindingLabel(bindings[def.id], isMac).split(' + ')}
                                    onCapture={() => setRecordingAction(def.id)}
                                    onReset={() => handleResetOne(def.id)}
                                    isRecording={recordingAction === def.id}
                                />
                            ))}
                            <ShortcutItem label={t('shortcuts.closeModal')} keys={['Esc']} />
                        </div>
                    </div>

                    <div className="tengra-shortcuts-modal__category">
                        <h3 className="tengra-shortcuts-modal__category-title">{t('shortcuts.navigation')}</h3>
                        <div className="tengra-shortcuts-modal__category-list">
                            {grouped.navigation.map(def => (
                                <ShortcutItem
                                    key={def.id}
                                    label={t(def.labelKey)}
                                    keys={shortcutBindingLabel(bindings[def.id], isMac).split(' + ')}
                                    onCapture={() => setRecordingAction(def.id)}
                                    onReset={() => handleResetOne(def.id)}
                                    isRecording={recordingAction === def.id}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="tengra-shortcuts-modal__category">
                        <h3 className="tengra-shortcuts-modal__category-title">{t('shortcuts.chat')}</h3>
                        <div className="tengra-shortcuts-modal__category-list">
                            {grouped.chat.map(def => (
                                <ShortcutItem
                                    key={def.id}
                                    label={t(def.labelKey)}
                                    keys={shortcutBindingLabel(bindings[def.id], isMac).split(' + ')}
                                    onCapture={() => setRecordingAction(def.id)}
                                    onReset={() => handleResetOne(def.id)}
                                    isRecording={recordingAction === def.id}
                                />
                            ))}
                            <ShortcutItem keys={['Enter']} label={t('shortcuts.sendMessage')} />
                            <ShortcutItem keys={['Shift', 'Enter']} label={t('shortcuts.newLine')} />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="tengra-shortcuts-modal__footer">
                    <p className="tengra-shortcuts-modal__footer-text">{t('shortcuts.footer')}</p>
                </div>
            </div>
        </div>
    );
});

KeyboardShortcutsModal.displayName = 'KeyboardShortcutsModal';
