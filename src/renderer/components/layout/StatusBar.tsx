/**
 * Status Bar Component
 * VSCode-like status bar with left/right sections and interactive items.
 */

import { AlertCircle, Bell, GitBranch, Loader2, Wifi, WifiOff, Zap } from 'lucide-react';
import React, { createContext, useCallback, useContext, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import './status-bar.css';

export interface StatusBarItem {
    id: string;
    content: React.ReactNode;
    tooltip?: string;
    onClick?: () => void;
    priority?: number; // Higher = more left (for left items) or more right (for right items)
    backgroundColor?: string;
    visible?: boolean;
}

interface StatusBarContextType {
    leftItems: StatusBarItem[];
    rightItems: StatusBarItem[];
    addItem: (item: StatusBarItem, position: 'left' | 'right') => void;
    removeItem: (id: string) => void;
    updateItem: (id: string, updates: Partial<StatusBarItem>) => void;
}

const StatusBarContext = createContext<StatusBarContextType | null>(null);

export const useStatusBar = () => {
    const context = useContext(StatusBarContext);
    if (!context) {
        throw new Error('useStatusBar must be used within StatusBarProvider');
    }
    return context;
};

// Status Bar Provider
export const StatusBarProvider: React.FC<{
    children: React.ReactNode;
    defaultLeftItems?: StatusBarItem[];
    defaultRightItems?: StatusBarItem[];
}> = ({ children, defaultLeftItems = [], defaultRightItems = [] }) => {
    const [leftItems, setLeftItems] = useState<StatusBarItem[]>(defaultLeftItems);
    const [rightItems, setRightItems] = useState<StatusBarItem[]>(defaultRightItems);

    const addItem = useCallback((item: StatusBarItem, position: 'left' | 'right') => {
        const setter = position === 'left' ? setLeftItems : setRightItems;
        setter(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev;
            }
            const newItems = [...prev, item];
            return newItems.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        });
    }, []);

    const removeItem = useCallback((id: string) => {
        setLeftItems(prev => prev.filter(i => i.id !== id));
        setRightItems(prev => prev.filter(i => i.id !== id));
    }, []);

    const updateItem = useCallback((id: string, updates: Partial<StatusBarItem>) => {
        const updater = (items: StatusBarItem[]) =>
            items.map(item => (item.id === id ? { ...item, ...updates } : item));
        setLeftItems(updater);
        setRightItems(updater);
    }, []);

    return (
        <StatusBarContext.Provider
            value={{ leftItems, rightItems, addItem, removeItem, updateItem }}
        >
            {children}
        </StatusBarContext.Provider>
    );
};

// Status Bar Item Component
const StatusBarItemView: React.FC<{
    item: StatusBarItem;
}> = ({ item }) => {
    if (item.visible === false) {
        return null;
    }

    return (
        <div
            onClick={item.onClick}
            title={item.tooltip}
            className={cn(
                "tengra-status-bar__item",
                item.onClick && "tengra-status-bar__item--clickable"
            )}
            style={item.backgroundColor ? { backgroundColor: item.backgroundColor } : undefined}
        >
            {item.content}
        </div>
    );
};

// Main Status Bar Component
export const StatusBar: React.FC<{
    className?: string;
    variant?: 'default' | 'primary' | 'warning' | 'error';
}> = ({ className, variant = 'default' }) => {
    const { leftItems, rightItems } = useStatusBar();

    return (
        <div
            className={cn(
                "tengra-status-bar",
                `tengra-status-bar--${variant}`,
                className
            )}
        >
            {/* Left section */}
            <div className="tengra-status-bar__left">
                {leftItems.map(item => (
                    <StatusBarItemView key={item.id} item={item} />
                ))}
            </div>

            {/* Right section */}
            <div className="tengra-status-bar__right">
                {rightItems.map(item => (
                    <StatusBarItemView key={item.id} item={item} />
                ))}
            </div>
        </div>
    );
};

// Pre-built Status Items
export const GitBranchStatus: React.FC<{
    branch?: string;
    modified?: number;
    onClick?: () => void;
}> = ({ branch = 'main', modified = 0, onClick }) => (
    <div
        onClick={onClick}
        className={cn(
            "tengra-status-bar__git",
            onClick && "tengra-status-bar__git--clickable"
        )}
    >
        <GitBranch className="tengra-status-bar__git-icon" />
        <span>{branch}</span>
        {modified > 0 && <span className="tengra-status-bar__git-modified">+{modified}</span>}
    </div>
);

export const ConnectionStatus: React.FC<{
    connected: boolean;
    label?: string;
    onClick?: () => void;
}> = ({ connected, label, onClick }) => (
    <div
        onClick={onClick}
        className={cn(
            "tengra-status-bar__connection",
            onClick && "tengra-status-bar__connection--clickable"
        )}
    >
        {connected ? (
            <Wifi className="tengra-status-bar__connection-icon" />
        ) : (
            <WifiOff className="tengra-status-bar__connection-icon tengra-status-bar__connection-icon--disconnected" />
        )}
        {label && <span>{label}</span>}
    </div>
);

export const NotificationBell: React.FC<{
    count?: number;
    onClick?: () => void;
}> = ({ count = 0, onClick }) => (
    <div
        onClick={onClick}
        className={cn(
            "tengra-status-bar__notification",
            onClick && "tengra-status-bar__notification--clickable"
        )}
    >
        <Bell className="tengra-status-bar__notification-icon" />
        {count > 0 && (
            <span className="tengra-status-bar__notification-badge">
                {count > 99 ? '99+' : count}
            </span>
        )}
    </div>
);

export const LoadingStatus: React.FC<{
    loading: boolean;
    label?: string;
}> = ({ loading, label }) => {
    if (!loading) {
        return null;
    }

    return (
        <div className="tengra-status-bar__loading">
            <Loader2 className="tengra-status-bar__loading-spinner" />
            {label && <span>{label}</span>}
        </div>
    );
};

export const ErrorStatus: React.FC<{
    count: number;
    onClick?: () => void;
}> = ({ count, onClick }) => {
    const { t } = useTranslation();
    if (count === 0) {
        return null;
    }
    const label = count === 1 ? t('statusBar.error') : t('statusBar.errors');

    return (
        <div
            onClick={onClick}
            className={cn(
                "tengra-status-bar__error",
                onClick && "tengra-status-bar__error--clickable"
            )}
        >
            <AlertCircle className="tengra-status-bar__error-icon" />
            <span>
                {count} {label}
            </span>
        </div>
    );
};

export const WarningStatus: React.FC<{
    count: number;
    onClick?: () => void;
}> = ({ count, onClick }) => {
    const { t } = useTranslation();
    if (count === 0) {
        return null;
    }
    const label = count === 1 ? t('statusBar.warning') : t('statusBar.warnings');

    return (
        <div
            onClick={onClick}
            className={cn(
                "tengra-status-bar__warning",
                onClick && "tengra-status-bar__warning--clickable"
            )}
        >
            <AlertCircle className="tengra-status-bar__warning-icon" />
            <span>
                {count} {label}
            </span>
        </div>
    );
};

export const ModelStatus: React.FC<{
    model?: string;
    onClick?: () => void;
}> = ({ model = 'GPT-4', onClick }) => (
    <div
        onClick={onClick}
        className={cn(
            "tengra-status-bar__model",
            onClick && "tengra-status-bar__model--clickable"
        )}
    >
        <Zap className="tengra-status-bar__model-icon" />
        <span>{model}</span>
    </div>
);

export default StatusBar;
