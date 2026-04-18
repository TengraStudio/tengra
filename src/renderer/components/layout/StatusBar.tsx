/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Status Bar Component
 * VSCode-like status bar with left/right sections and interactive items.
 */

import { AlertCircle, Bell, GitBranch, Loader2, Wifi, WifiOff, Zap } from 'lucide-react';
import React, { createContext, useCallback, useContext, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

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
    const { t } = useTranslation();
    const context = useContext(StatusBarContext);
    if (!context) {
        throw new Error(t('errors.context.useStatusBarProvider'));
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
                'flex items-center gap-1 px-2 py-0.5 text-10 transition-colors',
                item.onClick && 'cursor-pointer hover:bg-foreground/10'
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
    const variantClass = {
        default: 'bg-primary/90',
        primary: 'bg-primary',
        warning: 'bg-warning',
        error: 'bg-destructive',
    }[variant];

    return (
        <div
            className={cn(
                'flex h-6 select-none items-center justify-between text-foreground/90',
                variantClass,
                className
            )}
        >
            {/* Left section */}
            <div className="flex items-center">
                {leftItems.map(item => (
                    <StatusBarItemView key={item.id} item={item} />
                ))}
            </div>

            {/* Right section */}
            <div className="flex items-center">
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
            'flex items-center gap-1 px-2 py-0.5 text-10',
            onClick && 'cursor-pointer hover:bg-foreground/10'
        )}
    >
        <GitBranch className="h-3.5 w-3.5" />
        <span>{branch}</span>
        {modified > 0 && <span className="opacity-70">+{modified}</span>}
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
            'flex items-center gap-1 px-2 py-0.5 text-10',
            onClick && 'cursor-pointer hover:bg-foreground/10'
        )}
    >
        {connected ? (
            <Wifi className="h-3.5 w-3.5" />
        ) : (
            <WifiOff className="h-3.5 w-3.5 text-destructive" />
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
            'relative flex items-center px-2 py-0.5',
            onClick && 'cursor-pointer hover:bg-foreground/10'
        )}
    >
        <Bell className="h-3.5 w-3.5" />
        {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-1 text-8 font-bold">
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
        <div className="flex items-center gap-1 px-2 py-0.5 text-10">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
                'flex items-center gap-1 bg-destructive/50 px-2 py-0.5 text-10',
                onClick && 'cursor-pointer hover:bg-destructive/70'
            )}
        >
            <AlertCircle className="h-3.5 w-3.5" />
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
                'flex items-center gap-1 bg-warning/50 px-2 py-0.5 text-10',
                onClick && 'cursor-pointer hover:bg-warning/70'
            )}
        >
            <AlertCircle className="h-3.5 w-3.5" />
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
            'flex items-center gap-1 px-2 py-0.5 text-10',
            onClick && 'cursor-pointer hover:bg-foreground/10'
        )}
    >
        <Zap className="h-3.5 w-3.5" />
        <span>{model}</span>
    </div>
);

export default StatusBar;
