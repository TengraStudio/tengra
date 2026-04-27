/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { type Icon,IconAlertCircle, IconCircleCheck, IconDownload, IconRefresh, IconX } from '@tabler/icons-react';
import type { IpcRendererEvent } from 'electron';
import React, { useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { appLogger } from '@/utils/renderer-logger';


type UpdateState =
    | 'checking'
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'not-available'
    | 'error'
    | 'idle';

interface UpdateStatus {
    state: UpdateState;
    version?: string;
    progress?: number;
    bytesPerSecond?: number;
    total?: number;
    transferred?: number;
    error?: string;
}

interface StateConfig {
    icon: Icon;
    iconClass: string;
    title: string | ((version?: string) => string);
    content?: string | ((status: UpdateStatus) => React.ReactNode);
}

const getStateConfigs = (
    t: (key: string, options?: Record<string, string | number>) => string
): Partial<Record<UpdateState, StateConfig>> => ({
    checking: {
        icon: IconRefresh,
        iconClass: 'text-primary animate-spin',
        title: t('updateNotification.checkingTitle'),
    },
    available: {
        icon: IconDownload,
        iconClass: 'text-primary',
        title: version => t('updateNotification.availableTitle', { version: version ?? '' }),
        content: t('updateNotification.availableContent'),
    },
    downloading: {
        icon: IconDownload,
        iconClass: 'text-primary animate-pulse',
        title: t('updateNotification.downloadingTitle'),
    },
    downloaded: {
        icon: IconCircleCheck,
        iconClass: 'text-success',
        title: t('updateNotification.downloadedTitle'),
        content: t('updateNotification.downloadedContent'),
    },
    error: {
        icon: IconAlertCircle,
        iconClass: 'text-destructive',
        title: t('updateNotification.errorTitle'),
    },
    'not-available': {
        icon: IconCircleCheck,
        iconClass: 'text-muted-foreground',
        title: t('updateNotification.uptodateTitle'),
    },
});

const AUTO_SHOW_STATES: UpdateState[] = [
    'available',
    'downloading',
    'downloaded',
    'error',
    'not-available',
];

function formatBytes(bytes: number, decimals = 2): string {
    if (!+bytes) {
        return '0 B';
    }
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const DownloadProgress: React.FC<{ status: UpdateStatus }> = ({ status }) => (
    <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground font-mono">
            <span>{formatBytes(status.bytesPerSecond ?? 0)}/s</span>
            <span>{Math.round(status.progress ?? 0)}%</span>
        </div>
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/10 shadow-inner">
            <div
                className="h-full bg-primary transition-all duration-300 ease-out rounded-full shadow-glow-primary-strong"
                style={{ width: `${status.progress}%` }}
            />
        </div>
    </div>
);

interface ActionButtonProps {
    onClick: () => void;
    className: string;
    label: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ onClick, className, label }) => (
    <button
        onClick={onClick}
        className={cn('flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary shadow-sm hover:shadow-md active:scale-98', className)}
    >
        {label}
    </button>
);

export const UpdateNotification: React.FC = () => {
    const { t } = useTranslation();
    const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });
    const [isVisible, setIsVisible] = useState(false);
    const stateConfigs = useMemo(() => getStateConfigs(t), [t]);

    useEffect(() => {
        const handleUpdateStatus = (_event: IpcRendererEvent, newStatus: UpdateStatus) => {
            appLogger.info('UpdateNotification', 'Update status received', newStatus);
            setStatus(newStatus);

            if (AUTO_SHOW_STATES.includes(newStatus.state)) {
                setIsVisible(true);
            }

            if (newStatus.state === 'not-available') {
                setTimeout(() => setIsVisible(false), 3000);
            }
        };

        window.electron.ipcRenderer.on('update:status', handleUpdateStatus);
        return () => {
            window.electron.ipcRenderer.removeAllListeners('update:status');
        };
    }, []);

    const handleDownload = () => {
        void window.electron.ipcRenderer.invoke('update:download');
    };
    const handleInstall = () => {
        void window.electron.ipcRenderer.invoke('update:install');
    };
    const handleDismiss = () => {
        setIsVisible(false);
    };

    if (!isVisible || status.state === 'idle') {
        return null;
    }

    const config = stateConfigs[status.state];
    if (!config) {
        return null;
    }

    const Icon = config.icon;
    const title = typeof config.title === 'function' ? config.title(status.version) : config.title;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -50, x: 50 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed bottom-6 right-6 w-340 bg-background border border-border/40 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col font-sans backdrop-blur-md"
            >
                <div className="flex items-start justify-between p-4 border-b border-border/30 bg-muted/10">
                    <div className="flex items-center gap-3">
                        <Icon className={cn('w-5 h-5 flex-shrink-0', config.iconClass)} />
                        <h3 className="text-sm font-semibold text-foreground m-0 leading-tight">{title}</h3>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="p-1 -m-1 text-muted-foreground/60 hover:text-foreground transition-colors hover:bg-muted/50 rounded-md cursor-pointer"
                    >
                        <IconX className="w-4 h-4" />
                    </button>
                </div>

                <UpdateContent status={status} config={config} />

                <UpdateActions
                    state={status.state}
                    onDownload={handleDownload}
                    onInstall={handleInstall}
                    t={t}
                />
            </motion.div>
        </AnimatePresence>
    );
};

interface UpdateContentProps {
    status: UpdateStatus;
    config: Pick<StateConfig, 'content'>;
}

const UpdateContent: React.FC<UpdateContentProps> = ({ status, config }) => {
    const contentValue = config.content;
    const stringContent = typeof contentValue === 'string' ? contentValue : null;

    return (
        <div className="p-4 text-sm text-muted-foreground/90 leading-relaxed bg-background">
            {status.state === 'downloading' && <DownloadProgress status={status} />}
            {status.state === 'error' && status.error}
            {stringContent}
        </div>
    );
};

interface UpdateActionsProps {
    state: UpdateStatus['state'];
    onDownload: () => void;
    onInstall: () => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}

const UpdateActions: React.FC<UpdateActionsProps> = ({ state, onDownload, onInstall, t }) => (
    <div className="flex gap-2 p-3 bg-muted/20 border-t border-border/30">
        {state === 'available' && (
            <ActionButton
                onClick={onDownload}
                className="bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/20 hover:brightness-110"
                label={t('updateNotification.downloadAction')}
            />
        )}
        {state === 'downloaded' && (
            <ActionButton
                onClick={onInstall}
                className="bg-success text-success-foreground hover:bg-success/90 border border-success/20 hover:brightness-110"
                label={t('updateNotification.restartAction')}
            />
        )}
    </div>
);

UpdateNotification.displayName = 'UpdateNotification';
