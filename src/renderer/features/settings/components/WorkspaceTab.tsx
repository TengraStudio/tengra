import { Input } from '@renderer/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@renderer/components/ui/select';
import { terminalGetBackendsResponseSchema } from '@shared/schemas/terminal.schema';
import type { TerminalIpcContract } from '@shared/terminal-ipc';
import { Folder, HardDrive, Layout, RefreshCw, Search, Terminal } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { invokeTypedIpc } from '@/lib/ipc-client';

import type { SettingsSharedProps } from '../types';

import { SettingsField, SettingsInputClassName, SettingsPanel } from './SettingsPrimitives';

type WorkspaceTabProps = Pick<
    SettingsSharedProps,
    'settings' | 'updateGeneral' | 't'
>;

type TerminalBackendOption = {
    id: string;
    name: string;
    available: boolean;
};

export const WorkspaceTab: React.FC<WorkspaceTabProps> = ({
    settings,
    updateGeneral,
    t,
}) => {
    const [terminalBackends, setTerminalBackends] = useState<TerminalBackendOption[]>([]);
    const [isLoadingTerminalBackends, setIsLoadingTerminalBackends] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                setIsLoadingTerminalBackends(true);
                const backends = await invokeTypedIpc<TerminalIpcContract, 'terminal:getBackends'>(
                    'terminal:getBackends',
                    [],
                    { responseSchema: terminalGetBackendsResponseSchema }
                );
                if (!cancelled && Array.isArray(backends)) {
                    setTerminalBackends(backends);
                }
            } catch {
                if (!cancelled) {
                    setTerminalBackends([]);
                }
            } finally {
                if (!cancelled) {
                    setIsLoadingTerminalBackends(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const terminalBackendOptions = useMemo(() => {
        const options = terminalBackends.length > 0
            ? terminalBackends
            : [
                { id: 'node-pty', name: t('general.terminalBackendIntegrated'), available: true },
                { id: 'windows-terminal', name: t('general.terminalBackendWindowsTerminal'), available: true },
                { id: 'kitty', name: t('general.terminalBackendKitty'), available: true },
                { id: 'alacritty', name: t('general.terminalBackendAlacritty'), available: true },
            ];

        return options.map(backend => ({
            value: backend.id,
            label: backend.available ? backend.name : `${backend.name} ${t('general.terminalBackendUnavailable')}`,
        }));
    }, [t, terminalBackends]);

    if (!settings) {
        return null;
    }

    return (
        <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-10">
            <SettingsPanel
                title={t('settings.workspaceTitle')}
                description={t('settings.workspaceDescription')}
                icon={Layout}
            >
                <div className="grid gap-5 md:grid-cols-2">
                    <SettingsField
                        label={t('workspaceWizard.selectFolder')}
                        description={t('settings.workspacesBasePathDescription')}
                    >
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary/50" />
                            <Input
                                type="text"
                                value={settings.general.workspacesBasePath ?? ''}
                                onChange={event => {
                                    void updateGeneral({ workspacesBasePath: event.target.value });
                                }}
                                className={`${SettingsInputClassName} pl-10`}
                                placeholder={t('workspaceWizard.selectRootDesc')}
                            />
                        </div>
                    </SettingsField>

                    <SettingsField
                        label={t('general.terminalBackend')}
                        description={t('general.defaultTerminalBackendDesc')}
                    >
                        <Select
                            value={settings.general.defaultTerminalBackend ?? 'node-pty'}
                            onValueChange={value => {
                                void updateGeneral({ defaultTerminalBackend: value });
                            }}
                        >
                            <SelectTrigger className="h-11 w-full rounded-2xl bg-background">
                                <div className="flex items-center gap-2">
                                    <Terminal className="h-3.5 w-3.5 text-primary/50" />
                                    <SelectValue />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/30">
                                {terminalBackendOptions.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {isLoadingTerminalBackends && (
                            <div className="mt-2 flex items-center gap-2 px-1 text-[10px] text-muted-foreground/70">
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                <span>{t('common.loading')}</span>
                            </div>
                        )}
                    </SettingsField>

                    <SettingsField label={t('workspaceWizard.selectRootDesc')}>
                        <div className="flex h-11 items-center rounded-2xl border border-border/20 bg-background px-4 text-xs text-muted-foreground">
                            <Folder className="mr-2 h-3.5 w-3.5 text-primary/50" />
                            <span className="truncate">
                                {settings.general.workspacesBasePath || t('common.auto')}
                            </span>
                        </div>
                    </SettingsField>
                </div>
            </SettingsPanel>

            <SettingsPanel
                title={t('settings.runtimeTitle')}
                description={t('settings.runtimeDescription')}
                icon={HardDrive}
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/20 bg-background/60 px-4 py-4">
                        <div className="text-[11px] font-medium text-foreground">
                            {t('workspaceWizard.selectFolder')}
                        </div>
                        <div className="mt-2 text-xs leading-5 text-muted-foreground">
                            {settings.general.workspacesBasePath || t('workspaceWizard.selectRootDesc')}
                        </div>
                    </div>
                    <div className="rounded-2xl border border-border/20 bg-background/60 px-4 py-4">
                        <div className="text-[11px] font-medium text-foreground">
                            {t('general.terminalBackend')}
                        </div>
                        <div className="mt-2 text-xs leading-5 text-muted-foreground">
                            {settings.general.defaultTerminalBackend ?? t('general.terminalBackendIntegrated')}
                        </div>
                    </div>
                </div>
            </SettingsPanel>
        </div>
    );
};
