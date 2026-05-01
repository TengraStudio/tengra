/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconChevronRight, IconDatabase, IconServer } from '@tabler/icons-react';
import React, { useEffect, useState } from 'react';

import { UI_PRIMITIVES } from '@/constants/ui-primitives';
import { useTranslation } from '@/i18n';
import { invokeTypedIpc } from '@/lib/ipc-client';
import { cn } from '@/lib/utils';
import { SSHConfig } from '@/types/ssh';
import { appLogger } from '@/utils/renderer-logger';

import {
    terminalGetDockerContainersResponseSchema,
    TerminalIpcContract
} from '../utils/terminal-ipc';


interface ConnectionOption {
    id: string;
    name: string;
    type: 'local' | 'ssh' | 'docker';
    metadata?: Record<string, RendererDataValue>;
}

interface SshProfileOption extends SSHConfig {
    id: string;
}

interface DockerContainerOption {
    id: string;
    name: string;
    status: string;
}

interface RawDockerContainer {
    Id: string;
    Names: string[];
    Status: string;
}

interface TerminalConnectionSelectorProps {
    onSelect: (option: ConnectionOption) => void;
    onClose: () => void;
}

export const TerminalConnectionSelector: React.FC<TerminalConnectionSelectorProps> = ({ onSelect, onClose }) => {
    const { t } = useTranslation();
    const [sshProfiles, setSshProfiles] = useState<SshProfileOption[]>([]);
    const [containers, setContainers] = useState<DockerContainerOption[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch SSH profiles
                const profiles = await window.electron.ssh.getProfiles();
                setSshProfiles(
                    profiles.map((profile, index) => ({
                        ...profile,
                        id: `${profile.host}:${profile.port}:${profile.username}:${index}`
                    }))
                );

                // Fetch Docker containers
                const dockerResult = await invokeTypedIpc<TerminalIpcContract, 'terminal:getDockerContainers'>('terminal:getDockerContainers', [], { responseSchema: terminalGetDockerContainersResponseSchema });
                if (dockerResult.success && Array.isArray(dockerResult.containers)) {
                    // SAFETY: The docker result containers are evaluated and passed by the IPC boundary schema, but lose strict typing.
                    const mappedContainers: DockerContainerOption[] = (dockerResult.containers as TypeAssertionValue as RawDockerContainer[]).map(c => ({
                        id: c.Id,
                        name: Array.isArray(c.Names) ? c.Names[0].replace(/^\//, '') : c.Id.substring(0, 12),
                        status: c.Status
                    }));
                    setContainers(mappedContainers);
                } else {
                    setContainers([]);
                }
            } catch (error) {
                appLogger.error('TerminalSelector', 'Failed to fetch connection options', error as Error);
            } finally {
                setLoading(false);
            }
        };

        void fetchData();
    }, []);

    const handleSelect = (option: ConnectionOption) => {
        onSelect(option);
        onClose();
    };

    return (
        <div className={UI_PRIMITIVES.OVERLAY_BASE} onClick={onClose}>
            <div
                className={cn(UI_PRIMITIVES.PANEL_BASE, "w-400 max-h-500 shadow-2xl")}
                onClick={e => e.stopPropagation()}
            >
                <div className={UI_PRIMITIVES.PANEL_SUB_HEADER}>
                    <h3 className="typo-body font-bold text-foreground pl-2">{t('frontend.terminal.select_connection')}</h3>
                </div>

                <div className="flex-1 overflow-y-auto p-1 space-y-4">
                    {/* Local Terminal */}
                    <div className="space-y-1">
                        <div
                            className={cn(UI_PRIMITIVES.MENU_ITEM_BASE, "group")}
                            onClick={() => handleSelect({ id: 'local', name: t('frontend.terminal.local'), type: 'local' })}
                        >
                            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <IconDatabase size={16} />
                            </div>
                            <div className="flex-1 flex flex-col">
                                <span className={cn(UI_PRIMITIVES.MENU_ITEM_BASE, "p-0 bg-transparent font-bold")}>{t('frontend.terminal.local_terminal')}</span>
                                <span className="text-sm text-muted-foreground">{t('frontend.terminal.local_terminal_desc')}</span>
                            </div>
                            <IconChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <h4 className="px-3 text-sm font-bold text-muted-foreground/60 uppercase ">{t('frontend.terminal.ssh_connections')}</h4>
                        {sshProfiles.length === 0 && !loading && (
                            <div className="px-3 py-2 text-sm text-muted-foreground ">{t('frontend.terminal.no_ssh_profiles')}</div>
                        )}
                        {sshProfiles.map(profile => (
                            <div
                                key={profile.id}
                                className={cn(UI_PRIMITIVES.MENU_ITEM_BASE, "group")}
                                onClick={() => handleSelect({
                                    id: profile.id,
                                    name: profile.name || profile.host,
                                    type: 'ssh',
                                    metadata: { host: profile.host, port: profile.port, username: profile.username }
                                })}
                            >
                                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted/50 text-muted-foreground group-hover:text-foreground">
                                    <IconServer size={16} />
                                </div>
                                <div className="flex-1 flex flex-col">
                                    <span className={cn(UI_PRIMITIVES.MENU_ITEM_BASE, "p-0 bg-transparent font-bold")}>{profile.name || profile.host}</span>
                                    <span className="text-sm text-muted-foreground">{profile.username}@{profile.host}:{profile.port}</span>
                                </div>
                                <IconChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        ))}
                    </div>

                    <div className="space-y-1">
                        <h4 className="px-3 text-sm font-bold text-muted-foreground/60 uppercase ">{t('frontend.terminal.docker_containers')}</h4>
                        {containers.length === 0 && !loading && (
                            <div className="px-3 py-2 text-sm text-muted-foreground ">{t('frontend.terminal.no_containers')}</div>
                        )}
                        {containers.map(container => (
                            <div
                                key={container.id}
                                className={cn(UI_PRIMITIVES.MENU_ITEM_BASE, "group")}
                                onClick={() => handleSelect({
                                    id: container.id,
                                    name: container.name,
                                    type: 'docker',
                                    metadata: { containerId: container.id, shell: '/bin/bash' }
                                })}
                            >
                                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                                    <div className="typo-overline font-bold border border-current px-1 rounded">D</div>
                                </div>
                                <div className="flex-1 flex flex-col">
                                    <span className={cn(UI_PRIMITIVES.MENU_ITEM_BASE, "p-0 bg-transparent font-bold")}>{container.name}</span>
                                    <span className="text-sm text-muted-foreground">{container.status}</span>
                                </div>
                                <IconChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        ))}
                    </div>
                </div>

                {loading && (
                    <div className="p-4 text-center text-sm text-muted-foreground animate-pulse">
                        {t('common.loading')}
                    </div>
                )}
            </div>
        </div>
    );
};
