import { Archive, CheckCircle, CheckSquare, Clock, Gauge, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { TabType } from '../hooks/useMemoryLogic';

interface TabControlsProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
    pendingCount: number;
    confirmedCount: number;
    archivedCount: number;
}

export const TabControls = ({ activeTab, setActiveTab, pendingCount, confirmedCount, archivedCount }: TabControlsProps) => {
    const tabs = [
        { id: 'pending' as TabType, label: 'Pending', icon: Clock, count: pendingCount },
        { id: 'confirmed' as TabType, label: 'Confirmed', icon: CheckCircle, count: confirmedCount },
        { id: 'archived' as TabType, label: 'Archived', icon: Archive, count: archivedCount },
        { id: 'stats' as TabType, label: 'Statistics', icon: Gauge },
    ];

    return (
        <div className="flex gap-1 p-1 bg-muted/30 rounded-lg w-fit border border-white/5">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                        "px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                        activeTab === tab.id ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    )}
                >
                    <tab.icon className="w-4 h-4" />{tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                        <span className={cn(
                            "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                            activeTab === tab.id ? "bg-white/20" : "bg-primary/20 text-primary"
                        )}>
                            {tab.count}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
};

interface SelectionActionsProps {
    activeTab: TabType;
    hasPending: boolean;
    selectedCount: number;
    filteredCount: number;
    onConfirmAll: () => void;
    onRejectAll: () => void;
    onClearSelection: () => void;
    onArchiveSelected: () => void;
    onDeleteSelected: () => void;
    onSelectAll: () => void;
}

export const SelectionActions = ({
    activeTab, hasPending, selectedCount, filteredCount,
    onConfirmAll, onRejectAll, onClearSelection, onArchiveSelected, onDeleteSelected, onSelectAll
}: SelectionActionsProps) => {
    if (activeTab === 'pending' && hasPending) {
        return (
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onConfirmAll} className="gap-2"><CheckCircle className="w-4 h-4" />Confirm All</Button>
                <Button variant="ghost" size="sm" onClick={onRejectAll} className="gap-2 text-destructive"><X className="w-4 h-4" />Reject All</Button>
            </div>
        );
    }

    if ((activeTab === 'confirmed' || activeTab === 'archived') && filteredCount > 0) {
        return (
            <div className="flex gap-2">
                {selectedCount > 0 ? (
                    <>
                        <Button variant="ghost" size="sm" onClick={onClearSelection} className="gap-2"><X className="w-4 h-4" />Clear</Button>
                        {activeTab === 'confirmed' && <Button variant="outline" size="sm" onClick={onArchiveSelected} className="gap-2"><Archive className="w-4 h-4" />Archive</Button>}
                        <Button variant="destructive" size="sm" onClick={onDeleteSelected} className="gap-2"><X className="w-4 h-4" />Delete</Button>
                    </>
                ) : (
                    <Button variant="outline" size="sm" onClick={onSelectAll} className="gap-2"><CheckSquare className="w-4 h-4" />Select All</Button>
                )}
            </div>
        );
    }

    return null;
};
