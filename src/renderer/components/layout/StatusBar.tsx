/**
 * Status Bar Component
 * VSCode-like status bar with left/right sections and interactive items.
 */

import {
AlertCircle, Bell,
    GitBranch, Loader2,     Wifi, WifiOff, Zap
} from 'lucide-react';
import React, { createContext, useCallback,useContext, useState } from 'react';

import { cn } from '@/lib/utils';

export interface StatusBarItem {
    id: string
    content: React.ReactNode
    tooltip?: string
    onClick?: () => void
    priority?: number // Higher = more left (for left items) or more right (for right items)
    backgroundColor?: string
    visible?: boolean
}

interface StatusBarContextType {
    leftItems: StatusBarItem[]
    rightItems: StatusBarItem[]
    addItem: (item: StatusBarItem, position: 'left' | 'right') => void
    removeItem: (id: string) => void
    updateItem: (id: string, updates: Partial<StatusBarItem>) => void
}

const StatusBarContext = createContext<StatusBarContextType | null>(null);

export const useStatusBar = () => {
    const context = useContext(StatusBarContext);
    if (!context) {throw new Error('useStatusBar must be used within StatusBarProvider');}
    return context;
};

// Status Bar Provider
export const StatusBarProvider: React.FC<{
    children: React.ReactNode
    defaultLeftItems?: StatusBarItem[]
    defaultRightItems?: StatusBarItem[]
}> = ({ children, defaultLeftItems = [], defaultRightItems = [] }) => {
    const [leftItems, setLeftItems] = useState<StatusBarItem[]>(defaultLeftItems);
    const [rightItems, setRightItems] = useState<StatusBarItem[]>(defaultRightItems);

    const addItem = useCallback((item: StatusBarItem, position: 'left' | 'right') => {
        const setter = position === 'left' ? setLeftItems : setRightItems;
        setter(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {return prev;}
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
            items.map(item => item.id === id ? { ...item, ...updates } : item);
        setLeftItems(updater);
        setRightItems(updater);
    }, []);

    return (
        <StatusBarContext.Provider value={{ leftItems, rightItems, addItem, removeItem, updateItem }}>
            {children}
        </StatusBarContext.Provider>
    );
};

// Status Bar Item Component
const StatusBarItemView: React.FC<{
    item: StatusBarItem
}> = ({ item }) => {
    if (item.visible === false) {return null;}

    return (
        <div
            onClick={item.onClick}
            title={item.tooltip}
            className={cn(
                "flex items-center gap-1 px-2 py-0.5 text-[11px] transition-colors",
                item.onClick && "cursor-pointer hover:bg-white/10",
                item.backgroundColor
            )}
            style={item.backgroundColor ? { backgroundColor: item.backgroundColor } : undefined}
        >
            {item.content}
        </div>
    );
};

// Main Status Bar Component
export const StatusBar: React.FC<{
    className?: string
    variant?: 'default' | 'primary' | 'warning' | 'error'
}> = ({ className, variant = 'default' }) => {
    const { leftItems, rightItems } = useStatusBar();

    const variantClasses = {
        default: 'bg-primary/90',
        primary: 'bg-primary',
        warning: 'bg-amber-600',
        error: 'bg-red-600'
    };

    return (
        <div className={cn(
            "h-6 flex items-center justify-between text-foreground/90 select-none",
            variantClasses[variant],
            className
        )}>
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
    branch?: string
    modified?: number
    onClick?: () => void
}> = ({ branch = 'main', modified = 0, onClick }) => (
    <div
        onClick={onClick}
        className={cn(
            "flex items-center gap-1 px-2 py-0.5 text-[11px]",
            onClick && "cursor-pointer hover:bg-white/10"
        )}
    >
        <GitBranch className="w-3.5 h-3.5" />
        <span>{branch}</span>
        {modified > 0 && <span className="opacity-70">+{modified}</span>}
    </div>
);

export const ConnectionStatus: React.FC<{
    connected: boolean
    label?: string
    onClick?: () => void
}> = ({ connected, label, onClick }) => (
    <div
        onClick={onClick}
        className={cn(
            "flex items-center gap-1 px-2 py-0.5 text-[11px]",
            onClick && "cursor-pointer hover:bg-white/10"
        )}
    >
        {connected ? (
            <Wifi className="w-3.5 h-3.5" />
        ) : (
            <WifiOff className="w-3.5 h-3.5 text-red-300" />
        )}
        {label && <span>{label}</span>}
    </div>
);

export const NotificationBell: React.FC<{
    count?: number
    onClick?: () => void
}> = ({ count = 0, onClick }) => (
    <div
        onClick={onClick}
        className={cn(
            "relative flex items-center px-2 py-0.5",
            onClick && "cursor-pointer hover:bg-white/10"
        )}
    >
        <Bell className="w-3.5 h-3.5" />
        {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 flex items-center justify-center text-[9px] font-bold bg-red-500 rounded-full px-1">
                {count > 99 ? '99+' : count}
            </span>
        )}
    </div>
);

export const LoadingStatus: React.FC<{
    loading: boolean
    label?: string
}> = ({ loading, label }) => {
    if (!loading) {return null;}

    return (
        <div className="flex items-center gap-1 px-2 py-0.5 text-[11px]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {label && <span>{label}</span>}
        </div>
    );
};

export const ErrorStatus: React.FC<{
    count: number
    onClick?: () => void
}> = ({ count, onClick }) => {
    if (count === 0) {return null;}

    return (
        <div
            onClick={onClick}
            className={cn(
                "flex items-center gap-1 px-2 py-0.5 text-[11px] bg-red-600/50",
                onClick && "cursor-pointer hover:bg-red-600/70"
            )}
        >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{count} {count === 1 ? 'Error' : 'Errors'}</span>
        </div>
    );
};

export const WarningStatus: React.FC<{
    count: number
    onClick?: () => void
}> = ({ count, onClick }) => {
    if (count === 0) {return null;}

    return (
        <div
            onClick={onClick}
            className={cn(
                "flex items-center gap-1 px-2 py-0.5 text-[11px] bg-amber-600/50",
                onClick && "cursor-pointer hover:bg-amber-600/70"
            )}
        >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{count} {count === 1 ? 'Warning' : 'Warnings'}</span>
        </div>
    );
};

export const ModelStatus: React.FC<{
    model?: string
    onClick?: () => void
}> = ({ model = 'GPT-4', onClick }) => (
    <div
        onClick={onClick}
        className={cn(
            "flex items-center gap-1 px-2 py-0.5 text-[11px]",
            onClick && "cursor-pointer hover:bg-white/10"
        )}
    >
        <Zap className="w-3.5 h-3.5" />
        <span>{model}</span>
    </div>
);

export default StatusBar;
