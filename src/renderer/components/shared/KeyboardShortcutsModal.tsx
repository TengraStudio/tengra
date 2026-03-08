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
        <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 gap-3">
            <span className="text-sm text-muted-foreground/70">{label}</span>
            <div className="flex items-center gap-1.5">
                {keys.map((key, i) => (
                    <kbd key={`${key}-${i}`} className="px-2 py-1 bg-muted/50 border border-border/50 rounded text-xxs font-mono text-muted-foreground/80 min-w-[24px] text-center shadow-sm">
                        {key}
                    </kbd>
                ))}
                {onCapture && (
                    <button
                        onClick={onCapture}
                        className={`ml-1 px-2 py-1 text-xxs rounded border transition-colors ${isRecording ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground'}`}
                    >
                        {isRecording ? t('shortcuts.pressKeys') : t('common.edit')}
                    </button>
                )}
                {onReset && (
                    <button
                        onClick={onReset}
                        className="px-2 py-1 text-xxs rounded border bg-muted/20 border-border/50 text-muted-foreground hover:text-foreground transition-colors"
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

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = React.memo(({ isOpen, onClose, language = 'tr' }) => {
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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-modal-title"
        >
            <div
                ref={modalRef}
                tabIndex={-1}
                className="w-[640px] max-w-[95vw] bg-card border border-border/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            >
                <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json"
                    onChange={handleImport}
                    className="hidden"
                />

                {/* Header */}
                <div className="h-14 border-b border-border/50 flex items-center justify-between px-6 bg-muted/20">
                    <div className="flex items-center gap-2">
                        <Keyboard className="w-5 h-5 text-primary" aria-hidden="true" />
                        <h2 id="shortcuts-modal-title" className="text-lg font-medium text-foreground">{t('shortcuts.title')}</h2>
                    </div>
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        className="p-2 hover:bg-muted/30 rounded-lg transition-colors text-muted-foreground/60 hover:text-foreground"
                        aria-label={t('shortcuts.close')}
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                <div className="px-6 py-3 border-b border-border/50 flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder={t('shortcuts.searchPlaceholder')}
                            className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted/30 border border-border/50 text-sm outline-none focus:border-primary/50"
                        />
                    </div>
                    <button
                        onClick={handleExport}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 text-xs"
                    >
                        <Download className="w-3.5 h-3.5" /> {t('shortcuts.export')}
                    </button>
                    <button
                        onClick={() => importInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 text-xs"
                    >
                        <Upload className="w-3.5 h-3.5" /> {t('shortcuts.import')}
                    </button>
                    <button
                        onClick={handleResetAll}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 text-xs"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> {t('shortcuts.resetAll')}
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                    <div>
                        <h3 className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest mb-3 px-1">{t('shortcuts.general')}</h3>
                        <div className="bg-muted/20 rounded-xl px-4 border border-border/50">
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

                    <div>
                        <h3 className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest mb-3 px-1">{t('shortcuts.navigation')}</h3>
                        <div className="bg-muted/20 rounded-xl px-4 border border-border/50">
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

                    <div>
                        <h3 className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest mb-3 px-1">{t('shortcuts.chat')}</h3>
                        <div className="bg-muted/20 rounded-xl px-4 border border-border/50">
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
                <div className="p-4 bg-muted/20 border-t border-border/50 text-center">
                    <p className="text-xxs text-muted-foreground/40">{t('shortcuts.footer')}</p>
                </div>
            </div>
        </div>
    );
});

KeyboardShortcutsModal.displayName = 'KeyboardShortcutsModal';
