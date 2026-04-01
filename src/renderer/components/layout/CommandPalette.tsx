import { CommandFooter } from '@renderer/components/layout/command-palette/CommandFooter';
import { CommandHeader } from '@renderer/components/layout/command-palette/CommandHeader';
import { PreviewPanel } from '@renderer/components/layout/command-palette/PreviewPanel';
import { ResultsList } from '@renderer/components/layout/command-palette/ResultsList';
import {
    Cpu,
    Folder,
    MessageSquare,
    MessageSquarePlus,
    RefreshCw,
    Server,
    Settings,
    Trash2,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { SettingsCategory } from '@/features/settings/types';
import { useDebounce } from '@/hooks/useDebounce';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import type { ModelInfo } from '@/types';
import { Chat, Workspace } from '@/types';

export interface CommandItem {
    id: string;
    label: string;
    description?: string;
    icon: React.ReactNode;
    shortcut?: string;
    action: () => void;
    category: 'chat' | 'navigation' | 'model' | 'system' | 'workspaces' | 'actions';
    preview?: {
        title: string;
        content: string;
        metadata?: Record<string, string>;
    };
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    chats: Chat[];
    onSelectChat: (id: string) => void;
    onNewChat: () => void;
    workspaces: Workspace[];
    onSelectWorkspace: (id: string) => void;
    onOpenSettings: (category?: SettingsCategory) => void;
    onOpenSSHManager: () => void;
    onRefreshModels: (bypassCache?: boolean) => void;
    models: ModelInfo[];
    onSelectModel: (name: string) => void;
    selectedModel: string | null;
    onClearChat: () => void;
    t: (key: string) => string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
    isOpen,
    onClose,
    chats,
    onSelectChat,
    onNewChat,
    workspaces,
    onSelectWorkspace,
    onOpenSettings,
    onOpenSSHManager,
    onRefreshModels,
    models,
    onSelectModel,
    selectedModel,
    onClearChat,
    t,
}) => {
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const debouncedSearch = useDebounce(search, 200);

    const commands: CommandItem[] = useMemo(() => {
        const base: CommandItem[] = [
            {
                id: 'new-chat',
                label: t('commandPalette.newChat'),
                description: t('commandPalette.newChatDesc'),
                icon: <MessageSquarePlus className="w-4 h-4" />,
                shortcut: 'N',
                action: () => {
                    onNewChat();
                    onClose();
                },
                category: 'chat',
            },
            {
                id: 'clear-chat',
                label: t('commandPalette.clearChat'),
                description: t('commandPalette.clearChatDesc'),
                icon: <Trash2 className="w-4 h-4" />,
                action: () => {
                    onClearChat();
                    onClose();
                },
                category: 'actions',
            },
            {
                id: 'settings',
                label: t('commandPalette.settings'),
                description: t('commandPalette.settingsDesc'),
                icon: <Settings className="w-4 h-4" />,
                shortcut: ',',
                action: () => {
                    onOpenSettings();
                    onClose();
                },
                category: 'navigation',
            },
            {
                id: 'ssh-manager',
                label: t('commandPalette.sshManager'),
                description: t('commandPalette.sshManagerDesc'),
                icon: <Server className="w-4 h-4" />,
                action: () => {
                    onOpenSSHManager();
                    onClose();
                },
                category: 'navigation',
            },
        ];

        const chatCmds: CommandItem[] = chats.slice(0, 5).map(c => ({
            id: `chat-${c.id}`,
            label: c.title,
            description: t('commandPalette.goToChat'),
            icon: <MessageSquare className="w-4 h-4" />,
            action: () => {
                onSelectChat(c.id);
                onClose();
            },
            category: 'chat' as const,
        }));

        const wsCmds: CommandItem[] = workspaces.slice(0, 5).map(p => ({
            id: `workspace-${p.id}`,
            label: p.title,
            description: t('commandPalette.goToWorkspace'),
            icon: <Folder className="w-4 h-4" />,
            action: () => {
                onSelectWorkspace(p.id);
                onClose();
            },
            category: 'workspaces' as const,
            preview: {
                title: p.title,
                content: p.path,
                metadata: {
                    [t('commandPalette.metadataType')]: p.type ?? t('commandPalette.unknown'),
                    [t('commandPalette.metadataCreated')]: new Date(p.createdAt).toLocaleDateString(),
                },
            },
        }));

        const modelCmds: CommandItem[] = [
            {
                id: 'refresh-models',
                label: t('commandPalette.refreshModels'),
                description: t('commandPalette.refreshModelsDesc'),
                icon: <RefreshCw className="w-4 h-4" />,
                action: () => {
                    onRefreshModels(true);
                    onClose();
                },
                category: 'model' as const,
            },
            ...models.map(m => {
                const name = m.name ?? m.id ?? t('commandPalette.unknown');
                return {
                    id: `model-${name}`,
                    label: name,
                    description:
                        name === selectedModel
                            ? '✓ ' + t('commandPalette.activeModel')
                            : t('commandPalette.switchToModel'),
                    icon: <Cpu className="w-4 h-4" />,
                    action: () => {
                        onSelectModel(name);
                        onClose();
                    },
                    category: 'model' as const,
                    preview: {
                        title: name,
                        content: m.id ?? t('commandPalette.noDetails'),
                        metadata: {
                            [t('commandPalette.metadataProvider')]: m.id?.split(':')[0] ?? t('commandPalette.unknown')
                        },
                    },
                };
            }),
        ];

        return [...base, ...chatCmds, ...wsCmds, ...modelCmds];
    }, [
        chats,
        workspaces,
        models,
        selectedModel,
        onNewChat,
        onOpenSettings,
        onOpenSSHManager,
        onRefreshModels,
        onSelectModel,
        onSelectChat,
        onSelectWorkspace,
        onClearChat,
        onClose,
        t,
    ]);

    const filtered = useMemo(() => {
        const q = debouncedSearch.toLowerCase();
        return commands.filter(
            c =>
                c.label.toLowerCase().includes(q) ||
                (c.description?.toLowerCase().includes(q) ?? false) ||
                c.category.includes(q)
        );
    }, [commands, debouncedSearch]);

    useEffect(() => {
        if (isOpen) {
            setSearch('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        const handleModalKeydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key !== 'Tab' || !panelRef.current) {
                return;
            }
            const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            ));
            if (focusable.length === 0) {
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            if (event.shiftKey && active === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', handleModalKeydown);
        return () => {
            document.removeEventListener('keydown', handleModalKeydown);
        };
    }, [isOpen, onClose]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered[selectedIndex]) {
                filtered[selectedIndex].action();
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    const grouped = useMemo(() => {
        const groups: Record<string, CommandItem[]> = {};
        filtered.forEach(c => {
            const cat = c.category;
            if (!(cat in groups)) {
                groups[cat] = [];
            }
            groups[cat].push(c);
        });
        return groups;
    }, [filtered]);

    const categoryLabels: Record<string, string> = {
        chat: t('commandPalette.chats'),
        workspaces: t('commandPalette.workspaces'),
        navigation: t('commandPalette.navigation'),
        actions: t('commandPalette.actions'),
        model: t('commandPalette.models'),
    };
    let flatIdx = -1;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-start justify-center pt-20 md:pt-24"
                    onClick={onClose}
                >
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        ref={panelRef}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        className="relative w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl flex flex-col h-96"
                        role="dialog"
                        aria-modal="true"
                        aria-label={t('commandPalette.title')}
                        aria-describedby="command-palette-help"
                    >
                        <p id="command-palette-help" className="sr-only">
                            {t('commandPalette.keyboardHelp')}
                        </p>
                        <CommandHeader
                            search={search}
                            setSearch={setSearch}
                            onKeyDown={handleKeyDown}
                            onClose={onClose}
                            inputRef={inputRef}
                            t={t}
                        />
                        <div className="flex flex-1 overflow-hidden">
                            <ResultsList
                                groupedCommands={grouped}
                                categoryLabels={categoryLabels}
                                selectedIndex={selectedIndex}
                                setSelectedIndex={id => {
                                    const i = filtered.findIndex(c => c.id === id);
                                    if (i !== -1) {
                                        setSelectedIndex(i);
                                    }
                                }}
                                getFlatIndex={() => ++flatIdx}
                                noResults={filtered.length === 0}
                                t={t}
                            />
                            <PreviewPanel selectedItem={filtered[selectedIndex]} />
                        </div>
                        <CommandFooter t={t} />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

CommandPalette.displayName = 'CommandPalette';
