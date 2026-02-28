import { ChevronRight, HardDrive, Server } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
import { invokeTypedIpc } from '@/lib/ipc-client';
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
    metadata?: Record<string, unknown>;
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
                    const mappedContainers: DockerContainerOption[] = (dockerResult.containers as unknown as RawDockerContainer[]).map(c => ({
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
        <div className="connection-selector-overlay" onClick={onClose}>
            <div className="connection-selector-content" onClick={e => e.stopPropagation()}>
                <div className="selector-header">
                    <h3>{t('terminal.select_connection')}</h3>
                </div>

                <div className="selector-list">
                    {/* Local Terminal */}
                    <div className="selector-item" onClick={() => handleSelect({ id: 'local', name: t('terminal.local'), type: 'local' })}>
                        <div className="item-icon"><HardDrive size={16} /></div>
                        <div className="item-details">
                            <span className="item-name">{t('terminal.local_terminal')}</span>
                            <span className="item-desc">{t('terminal.local_terminal_desc')}</span>
                        </div>
                        <ChevronRight size={16} className="item-arrow" />
                    </div>

                    <div className="selector-section">
                        <h4>{t('terminal.ssh_connections')}</h4>
                        {sshProfiles.length === 0 && !loading && (
                            <div className="empty-message">{t('terminal.no_ssh_profiles')}</div>
                        )}
                        {sshProfiles.map(profile => (
                            <div key={profile.id} className="selector-item" onClick={() => handleSelect({
                                id: profile.id,
                                name: profile.name || profile.host,
                                type: 'ssh',
                                metadata: { host: profile.host, port: profile.port, username: profile.username }
                            })}>
                                <div className="item-icon"><Server size={16} /></div>
                                <div className="item-details">
                                    <span className="item-name">{profile.name || profile.host}</span>
                                    <span className="item-desc">{profile.username}@{profile.host}:{profile.port}</span>
                                </div>
                                <ChevronRight size={16} className="item-arrow" />
                            </div>
                        ))}
                    </div>

                    <div className="selector-section">
                        <h4>{t('terminal.docker_containers')}</h4>
                        {containers.length === 0 && !loading && (
                            <div className="empty-message">{t('terminal.no_containers')}</div>
                        )}
                        {containers.map(container => (
                            <div key={container.id} className="selector-item" onClick={() => handleSelect({
                                id: container.id,
                                name: container.name,
                                type: 'docker',
                                metadata: { containerId: container.id, shell: '/bin/bash' }
                            })}>
                                <div className="item-icon"><div className="docker-icon">D</div></div>
                                <div className="item-details">
                                    <span className="item-name">{container.name}</span>
                                    <span className="item-desc">{container.status}</span>
                                </div>
                                <ChevronRight size={16} className="item-arrow" />
                            </div>
                        ))}
                    </div>
                </div>

                {loading && <div className="selector-loading">{t('common.loading')}</div>}
            </div>
        </div>
    );
};
