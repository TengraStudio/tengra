import { Copy, Globe, LucideIcon, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Language, useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';


interface QuickActionBarProps {
    onExplain: (text: string) => void
    onTranslate: (text: string) => void
    language: Language
}

interface SelectionState {
    isVisible: boolean
    position: { x: number; y: number }
    selectedText: string
}

const ALLOWED_SELECTORS = ['.cm-editor', '.prose', '.message-content'];

function isInAllowedArea(element: Element | null): boolean {
    if (!element) { return false; }
    return ALLOWED_SELECTORS.some(selector => element.closest(selector));
}

function getSelectionPosition(rect: DOMRect): { x: number; y: number } {
    return { x: rect.left + rect.width / 2, y: rect.top - 10 };
}

function getSelectionData(): { text: string; rect: DOMRect; parent: Element | null } | null {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? '';
    if (text.length <= 2) { return null; }
    
    const range = selection?.getRangeAt(0);
    const rect = range?.getBoundingClientRect();
    if (!rect) { return null; }
    
    return { text, rect, parent: selection?.anchorNode?.parentElement ?? null };
}

function handleTextSelection(setSelectionState: React.Dispatch<React.SetStateAction<SelectionState>>): void {
    const data = getSelectionData();
    if (!data) { return; }
    
    if (isInAllowedArea(data.parent)) {
        setSelectionState({ isVisible: true, position: getSelectionPosition(data.rect), selectedText: data.text });
    }
}

function handleSelectionClear(isVisible: boolean, setSelectionState: React.Dispatch<React.SetStateAction<SelectionState>>): void {
    if (!isVisible) { return; }
    setTimeout(() => {
        const activeSelection = window.getSelection()?.toString().trim();
        if (!activeSelection) {
            setSelectionState(prev => ({ ...prev, isVisible: false }));
        }
    }, 100);
}

function useSelectionHandler(isVisible: boolean, setSelectionState: React.Dispatch<React.SetStateAction<SelectionState>>): void {
    useEffect(() => {
        const handleSelectionChange = () => {
            const text = window.getSelection()?.toString().trim();
            if (text && text.length > 2) {
                handleTextSelection(setSelectionState);
            } else {
                handleSelectionClear(isVisible, setSelectionState);
            }
        };

        document.addEventListener('mouseup', handleSelectionChange);
        document.addEventListener('keyup', handleSelectionChange);
        return () => {
            document.removeEventListener('mouseup', handleSelectionChange);
            document.removeEventListener('keyup', handleSelectionChange);
        };
    }, [isVisible, setSelectionState]);
}

interface ActionButtonProps {
    onClick: () => void
    icon: LucideIcon
    iconClass: string
    label: string
}

const ActionButton: React.FC<ActionButtonProps> = ({ onClick, icon: Icon, iconClass, label }) => (
    <button
        onClick={onClick}
        className="tengra-quick-action-bar__button"
        aria-label={label}
    >
        <Icon className={`tengra-quick-action-bar__button-icon ${iconClass}`} />
        <span>{label}</span>
    </button>
);

export function QuickActionBar({ onExplain, onTranslate, language }: QuickActionBarProps) {
    const { t } = useTranslation(language);
    const [selectionState, setSelectionState] = useState<SelectionState>({
        isVisible: false,
        position: { x: 0, y: 0 },
        selectedText: ''
    });
    const barRef = useRef<HTMLDivElement>(null);

    useSelectionHandler(selectionState.isVisible, setSelectionState);

    const hide = useCallback(() => setSelectionState(prev => ({ ...prev, isVisible: false })), []);

    const handleCopy = useCallback(() => {
        void navigator.clipboard.writeText(selectionState.selectedText);
        hide();
    }, [selectionState.selectedText, hide]);

    const handleExplain = useCallback(() => {
        onExplain(selectionState.selectedText);
        hide();
    }, [onExplain, selectionState.selectedText, hide]);

    const handleTranslate = useCallback(() => {
        onTranslate(selectionState.selectedText);
        hide();
    }, [onTranslate, selectionState.selectedText, hide]);

    useEffect(() => {
        if (!selectionState.isVisible) {
            return;
        }
        const handleHotkeys = (event: KeyboardEvent) => {
            if (!event.altKey) {
                return;
            }
            const key = event.key.toLowerCase();
            if (key === 'e') {
                event.preventDefault();
                handleExplain();
            } else if (key === 't') {
                event.preventDefault();
                handleTranslate();
            } else if (key === 'c') {
                event.preventDefault();
                handleCopy();
            }
        };
        document.addEventListener('keydown', handleHotkeys);
        return () => {
            document.removeEventListener('keydown', handleHotkeys);
        };
    }, [handleCopy, handleExplain, handleTranslate, selectionState.isVisible]);

    const positionStyle = useMemo(() => ({
        position: 'fixed' as const,
        left: selectionState.position.x,
        top: selectionState.position.y,
        transform: 'translate(-50%, -100%)',
        zIndex: 1000
    }), [selectionState.position.x, selectionState.position.y]);

    if (!selectionState.isVisible) { return null; }

    return (
        <AnimatePresence>
            <motion.div
                ref={barRef}
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                style={positionStyle}
                className="tengra-quick-action-bar"
                onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
                role="toolbar"
                aria-label={t('quickAction.toolbar')}
            >
                <ActionButton onClick={handleExplain} icon={Sparkles} iconClass="tengra-quick-action-bar__button-icon--explain" label={t('quickAction.explainWithHotkey', { hotkey: 'Alt+E' })} />
                <div className="tengra-quick-action-bar__divider" />
                <ActionButton onClick={handleTranslate} icon={Globe} iconClass="tengra-quick-action-bar__button-icon--translate" label={t('quickAction.translateWithHotkey', { hotkey: 'Alt+T' })} />
                <div className="tengra-quick-action-bar__divider" />
                <button onClick={handleCopy} className="tengra-quick-action-bar__icon-button" title={t('quickAction.copyWithHotkey', { hotkey: 'Alt+C' })} aria-label={t('quickAction.copyWithHotkey', { hotkey: 'Alt+C' })}>
                    <Copy className="tengra-quick-action-bar__button-icon" />
                </button>
                <button onClick={hide} className="tengra-quick-action-bar__icon-button tengra-quick-action-bar__icon-button--close" aria-label={t('common.close')}>
                    <X className="tengra-quick-action-bar__button-icon" />
                </button>
            </motion.div>
        </AnimatePresence>
    );
}
