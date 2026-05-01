/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { safeJsonParse } from '@shared/utils/sanitize.util';
import { IconBox, IconPlayerPlay, IconRefresh, IconSquare, IconTerminal, IconTrash } from '@tabler/icons-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface ContainerInfo {
    id: string;
    name: string;
    image: string;
    status: string;
    state: 'running' | 'exited' | 'paused' | 'created' | 'unknown';
    ports: string;
    created: string;
}

const ContainerItem: React.FC<{
    container: ContainerInfo;
    selected: boolean;
    onSelect: (id: string) => void;
    onAction: (a: 'start' | 'stop' | 'rm', id: string) => void;
    onOpenTerminal?: (n: string, c: string) => void;
    t: (k: string) => string;
}> = React.memo(({ container, selected, onSelect, onAction, onOpenTerminal, t }) => {
    const getStateColor = (s: string) => {
        switch (s) {
            case 'running': {
                return 'text-success bg-success/20';
            }
            case 'exited': {
                return 'text-destructive bg-destructive/20';
            }
            case 'paused': {
                return 'text-warning bg-yellow/20';
            }
            default: {
                return 'text-muted-foreground bg-muted/20';
            }
        }
    };
    return (
        <div
            onClick={() => {
                onSelect(container.id);
            }}
            className={cn(
                'p-3 rounded-xl border cursor-pointer transition-all',
                selected
                    ? 'bg-primary/20 border-primary shadow-sm'
                    : 'bg-muted/30 border-border/50 hover:bg-muted/50'
            )}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-foreground text-sm truncate">
                    {container.name}
                </span>
                <span
                    className={cn(
                        'typo-caption px-2 py-0.5 rounded-full capitalize',
                        getStateColor(container.state)
                    )}
                >
                    {container.state}
                </span>
            </div>
            <div className="typo-caption text-muted-foreground truncate">{container.image}</div>
            {container.ports && (
                <div className="typo-caption text-neutral mt-1 truncate">{container.ports}</div>
            )}
            <div className="flex gap-1 mt-2">
                {container.state === 'running' ? (
                    <button
                        onClick={e => {
                            e.stopPropagation();
                            onAction('stop', container.id);
                        }}
                        className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                        title={t('frontend.docker.stop')}
                    >
                        <IconSquare size={14} />
                    </button>
                ) : (
                    <button
                        onClick={e => {
                            e.stopPropagation();
                            onAction('start', container.id);
                        }}
                        className="p-1.5 rounded hover:bg-success/20 text-muted-foreground hover:text-success"
                        title={t('frontend.docker.start')}
                    >
                        <IconPlayerPlay size={14} />
                    </button>
                )}
                <button
                    onClick={e => {
                        e.stopPropagation();
                        onAction('rm', container.id);
                    }}
                    className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                    title={t('frontend.docker.remove')}
                >
                    <IconTrash size={14} />
                </button>
                {onOpenTerminal && (
                    <button
                        onClick={e => {
                            e.stopPropagation();
                            onOpenTerminal(
                                `Docker: ${container.name}`,
                                `docker exec -it ${container.id} /bin/sh`
                            );
                        }}
                        className="p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary"
                        title={t('frontend.docker.shell')}
                    >
                        <IconTerminal size={14} />
                    </button>
                )}
            </div>
        </div>
    );
});

interface DockerStats {
    ID: string;
    Names: string;
    Image: string;
    Status: string;
    State: string;
    Ports: string;
    CreatedAt: string;
}

export function DockerDashboard({
    isOpen = true,
    onOpenTerminal,
    language,
}: {
    isOpen?: boolean;
    onOpenTerminal?: (name: string, command: string) => void;
    language: Language;
}) {
    const { t } = useTranslation(language);
    const [containers, setContainers] = useState<ContainerInfo[]>([]);
    const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
    const [logs, setLogs] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadContainers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await window.electron.runCommand(
                'docker',
                ['ps', '-a', '--format', '{{json .}}'],
                process.cwd()
            );
            if (res.stderr && !res.stdout) {
                setError(t('frontend.docker.notRunning'));
                return;
            }
            const parsed = res.stdout
                .trim()
                .split('\n')
                .filter(Boolean)
                .map(line => {
                    const d = safeJsonParse<DockerStats>(line, {} as DockerStats);
                    if (!d.ID) {
                        return null;
                    }
                    return {
                        id: d.ID,
                        name: d.Names,
                        image: d.Image,
                        status: d.Status,
                        state: (d.State.toLowerCase() || 'unknown') as ContainerInfo['state'],
                        ports: d.Ports,
                        created: d.CreatedAt,
                    };
                })
                .filter((c): c is ContainerInfo => {
                    return !!c;
                });
            setContainers(parsed);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('frontend.docker.failedLoad'));
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    const loadLogs = useCallback(
        async (id: string) => {
            try {
                const res = await window.electron.runCommand(
                    'docker',
                    ['logs', '--tail', '100', id],
                    process.cwd()
                );
                setLogs(res.stdout || res.stderr || t('frontend.docker.noLogs'));
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                setLogs(t('frontend.docker.logsError', { message }));
            }
        },
        [t]
    );

    useEffect(() => {
        if (isOpen) {
            void loadContainers();
        }
    }, [isOpen, loadContainers]);

    useEffect(() => {
        if (selectedContainer) {
            void loadLogs(selectedContainer);
        }
    }, [selectedContainer, loadLogs]);

    const handleAction = useCallback(
        (a: 'start' | 'stop' | 'rm', id: string) => {
            void window.electron
                .runCommand('docker', [a, id], process.cwd())
                .then(() => {
                    void loadContainers();
                })
                .catch((e: Error) => {
                    setError(e.message || String(e));
                });
        },
        [loadContainers]
    );

    if (!isOpen) {
        return null;
    }

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-info/20 to-primary/20 border border-primary/30">
                        <IconBox size={20} className="text-primary" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-foreground">{t('frontend.docker.title')}</h2>
                        <p className="typo-caption text-muted-foreground">
                            {containers.length} {t('frontend.docker.containers')}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        void loadContainers();
                    }}
                    disabled={isLoading}
                    className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                >
                    <IconRefresh size={18} className={cn(isLoading && 'animate-spin')} />
                </button>
            </div>
            {error && (
                <div className="mx-4 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {error}
                </div>
            )}
            <div className="flex-1 flex overflow-hidden">
                <div className="w-1/2 border-r border-border/50 overflow-y-auto p-4 space-y-2">
                    {containers.length === 0 && !isLoading && (
                        <div className="text-center text-muted-foreground text-sm py-8">
                            {t('frontend.docker.noContainers')}
                        </div>
                    )}
                    {containers.map(c => (
                        <ContainerItem
                            key={c.id}
                            container={c}
                            selected={selectedContainer === c.id}
                            onSelect={setSelectedContainer}
                            onAction={handleAction}
                            onOpenTerminal={onOpenTerminal}
                            t={t}
                        />
                    ))}
                </div>
                <div className="w-1/2 flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-border/50 flex items-center gap-2">
                        <IconTerminal size={14} className="text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{t('frontend.docker.logs')}</span>
                    </div>
                    <pre className="flex-1 p-4 typo-caption font-mono text-muted-foreground overflow-y-auto whitespace-pre-wrap">
                        {selectedContainer
                            ? logs || t('frontend.docker.loading')
                            : t('frontend.docker.selectContainer')}
                    </pre>
                </div>
            </div>
        </div>
    );
}
