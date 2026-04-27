/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconDownload, IconKeyboard, IconRotate, IconSearch, IconUpload, IconX } from '@tabler/icons-react';
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
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/40 transition-colors hover:bg-muted/40 hover:border-border/60">
            <span className="font-medium text-foreground">{label}</span>
            <div className="flex items-center gap-2">
                {keys.map((key, i) => (
                    <kbd key={`${key}-${i}`} className="inline-flex items-center justify-center h-7 min-w-7 px-2 font-mono text-sm font-semibold text-foreground bg-background border border-border/50 rounded shadow-sm">
                        {key}
                    </kbd>
                ))}
                {onCapture && (
                    <button
                        onClick={onCapture}
                        className={cn('px-2.5 py-1 text-sm font-medium border rounded-md transition-colors cursor-pointer backdrop-blur-sm', isRecording ? 'bg-primary/10 text-primary border-primary/30 shadow-glow-primary-soft animate-pulse' : 'bg-transparent border-transparent text-muted-foreground hover:bg-muted hover:border-border/60 hover:text-foreground')}
                    >
                        {isRecording ? t('shortcuts.pressKeys') : t('common.edit')}
                    </button>
                )}
                {onReset && (
                    <button
                        onClick={onReset}
                        className="p-1 text-muted-foreground/50 bg-transparent border-none rounded-md cursor-pointer transition-colors hover:bg-destructive/10 hover:text-destructive"
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-modal-title"
        >
            <div className="absolute inset-0 bg-background/60 backdrop-blur-4 animate-in fade-in duration-200" onClick={onClose} aria-hidden="true" />
            <div
                ref={modalRef}
                tabIndex={-1}
                className="relative flex flex-col w-full max-w-3xl max-h-85vh bg-background border border-border/50 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 outline-none"
            >
                <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json"
                    onChange={handleImport}
                    className="hidden"
                />

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/10">
                    <div className="flex items-center gap-3">
                        <div className="flex justify-center items-center p-2 bg-primary/10 rounded-lg text-primary"><IconKeyboard className="w-5 h-5" aria-hidden="true" /></div>
                        <h2 id="shortcuts-modal-title" className="text-lg font-bold text-foreground m-0">{t('shortcuts.title')}</h2>
                    </div>
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        className="p-2 text-muted-foreground bg-transparent border-none rounded-lg cursor-pointer transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={t('shortcuts.close')}
                    >
                        <IconX className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border/50 bg-background/50">
                    <div className="relative flex-1 min-w-200">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder={t('shortcuts.searchPlaceholder')}
                            className="w-full h-9 pl-9 pr-4 text-sm bg-muted/20 border border-border/50 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-sans"
                        />
                    </div>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground bg-background border border-border/50 rounded-md cursor-pointer transition-colors hover:bg-muted shadow-sm"
                    >
                        <IconDownload className="w-3.5 h-3.5 text-muted-foreground" /> {t('shortcuts.export')}
                    </button>
                    <button
                        onClick={() => importInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground bg-background border border-border/50 rounded-md cursor-pointer transition-colors hover:bg-muted shadow-sm"
                    >
                        <IconUpload className="w-3.5 h-3.5 text-muted-foreground" /> {t('shortcuts.import')}
                    </button>
                    <button
                        onClick={handleResetAll}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground bg-background border border-border/50 rounded-md cursor-pointer transition-colors hover:bg-muted shadow-sm"
                    >
                        <IconRotate className="w-3.5 h-3.5 text-muted-foreground" /> {t('shortcuts.resetAll')}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-background">
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-primary/80 uppercase ">{t('shortcuts.general')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-primary/80 uppercase ">{t('shortcuts.navigation')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-primary/80 uppercase ">{t('shortcuts.chat')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <div className="p-4 border-t border-border/50 bg-muted/10 text-center">
                    <p className="text-sm text-muted-foreground m-0">{t('shortcuts.footer')}</p>
                </div>
            </div>
        </div>
    );
});

KeyboardShortcutsModal.displayName = 'KeyboardShortcutsModal';
