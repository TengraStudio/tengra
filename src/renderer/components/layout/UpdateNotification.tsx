
import type { IpcRendererEvent } from 'electron';
import { AlertCircle, CheckCircle, Download, LucideIcon, RefreshCw, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { AnimatePresence, motion } from '@/lib/framer-motion-compat';

type UpdateState = 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error' | 'idle';

interface UpdateStatus {
    state: UpdateState
    version?: string
    progress?: number
    bytesPerSecond?: number
    total?: number
    transferred?: number
    error?: string
}

interface StateConfig {
    icon: LucideIcon
    iconClass: string
    title: string | ((version?: string) => string)
    content?: string | ((status: UpdateStatus) => React.ReactNode)
}

const STATE_CONFIGS: Partial<Record<UpdateState, StateConfig>> = {
    checking: {
        icon: RefreshCw,
        iconClass: 'text-primary animate-spin',
        title: 'Checking for updates...'
    },
    available: {
        icon: Download,
        iconClass: 'text-primary',
        title: (version) => `Update Available: v${version}`,
        content: 'A new version of Tandem is available.'
    },
    downloading: {
        icon: Download,
        iconClass: 'text-primary animate-pulse',
        title: 'Downloading update...'
    },
    downloaded: {
        icon: CheckCircle,
        iconClass: 'text-success',
        title: 'Update Ready',
        content: 'Restart Tandem to apply the latest update.'
    },
    error: {
        icon: AlertCircle,
        iconClass: 'text-destructive',
        title: 'Update Failed'
    },
    'not-available': {
        icon: CheckCircle,
        iconClass: 'text-muted-foreground',
        title: 'You are up to date'
    }
};

const AUTO_SHOW_STATES: UpdateState[] = ['available', 'downloading', 'downloaded', 'error', 'not-available'];

function formatBytes(bytes: number, decimals = 2): string {
    if (!+bytes) { return '0 B'; }
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const DownloadProgress: React.FC<{ status: UpdateStatus }> = ({ status }) => (
    <div className="space-y-1">
        <div className="flex justify-between">
            <span>{formatBytes(status.bytesPerSecond ?? 0)}/s</span>
            <span>{Math.round(status.progress ?? 0)}%</span>
        </div>
        <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
            <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${status.progress}%` }}
            />
        </div>
    </div>
);

interface ActionButtonProps {
    onClick: () => void
    className: string
    label: string
}

const ActionButton: React.FC<ActionButtonProps> = ({ onClick, className, label }) => (
    <button onClick={onClick} className={`flex-1 text-foreground text-xs py-1.5 px-3 rounded transition-colors ${className}`}>
        {label}
    </button>
);

export const UpdateNotification: React.FC = () => {
    const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleUpdateStatus = (_event: IpcRendererEvent, newStatus: UpdateStatus) => {
            console.warn('Update status received:', newStatus);
            setStatus(newStatus);

            if (AUTO_SHOW_STATES.includes(newStatus.state)) {
                setIsVisible(true);
            }

            if (newStatus.state === 'not-available') {
                setTimeout(() => setIsVisible(false), 3000);
            }
        };

        window.electron.ipcRenderer.on('update:status', handleUpdateStatus);
        return () => { window.electron.ipcRenderer.removeAllListeners('update:status'); };
    }, []);

    const handleDownload = () => { void window.electron.ipcRenderer.invoke('update:download'); };
    const handleInstall = () => { void window.electron.ipcRenderer.invoke('update:install'); };
    const handleDismiss = () => { setIsVisible(false); };

    if (!isVisible || status.state === 'idle') { return null; }

    const config = STATE_CONFIGS[status.state];
    if (!config) { return null; }

    const Icon = config.icon;
    const title = typeof config.title === 'function' ? config.title(status.version) : config.title;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -50, x: 50 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed top-20 right-4 z-50 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 overflow-hidden"
            >
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${config.iconClass}`} />
                        <h3 className="font-medium text-foreground text-sm">{title}</h3>
                    </div>
                    <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <UpdateContent status={status} config={config} />

                <UpdateActions state={status.state} onDownload={handleDownload} onInstall={handleInstall} />
            </motion.div>
        </AnimatePresence>
    );
};

interface UpdateContentProps {
    status: UpdateStatus
    config: Pick<StateConfig, 'content'>
}

const UpdateContent: React.FC<UpdateContentProps> = ({ status, config }) => {
    const contentValue = config.content;
    const stringContent = typeof contentValue === 'string' ? contentValue : null;

    return (
        <div className="text-xs text-muted-foreground mb-3">
            {status.state === 'downloading' && <DownloadProgress status={status} />}
            {status.state === 'error' && status.error}
            {stringContent}
        </div>
    );
};

interface UpdateActionsProps {
    state: UpdateStatus['state']
    onDownload: () => void
    onInstall: () => void
}

const UpdateActions: React.FC<UpdateActionsProps> = ({ state, onDownload, onInstall }) => (
    <div className="flex gap-2">
        {state === 'available' && <ActionButton onClick={onDownload} className="bg-blue-600 hover:bg-blue-700" label="Download" />}
        {state === 'downloaded' && <ActionButton onClick={onInstall} className="bg-green-600 hover:bg-green-700" label="Restart Now" />}
    </div>
);
