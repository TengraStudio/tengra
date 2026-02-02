import {
    AdvancedSemanticFragment,
    MemoryStatistics,
    PendingMemory
} from '@shared/types/advanced-memory';
import { useCallback, useEffect, useState } from 'react';

export type TabType = 'pending' | 'confirmed' | 'archived' | 'stats';

export function useMemoryLogic(searchQuery: string, activeTab: TabType) {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingMemories, setPendingMemories] = useState<PendingMemory[]>([]);
    const [confirmedMemories, setConfirmedMemories] = useState<AdvancedSemanticFragment[]>([]);
    const [stats, setStats] = useState<MemoryStatistics | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [pendingRes, statsRes] = await Promise.all([
                window.electron.advancedMemory.getPending(),
                window.electron.advancedMemory.getStats()
            ]);

            if (pendingRes.success) {
                setPendingMemories(pendingRes.data);
            }

            if (statsRes.success && statsRes.data) {
                setStats(statsRes.data);
            }

            if (searchQuery) {
                const searchRes = await window.electron.advancedMemory.search(searchQuery, 50);
                if (searchRes.success) {
                    setConfirmedMemories(searchRes.data);
                }
            } else {
                const recallRes = await window.electron.advancedMemory.recall({
                    query: '',
                    limit: 100,
                    includeArchived: activeTab === 'archived'
                });
                if (recallRes.success) {
                    setConfirmedMemories(recallRes.data.memories);
                }
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setIsLoading(false);
        }
    }, [searchQuery, activeTab]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleConfirm = async (id: string) => {
        const res = await window.electron.advancedMemory.confirm(id);
        if (res.success) {
            setPendingMemories(prev => prev.filter(p => p.id !== id));
            void loadData();
        }
    };

    const handleReject = async (id: string) => {
        const res = await window.electron.advancedMemory.reject(id);
        if (res.success) {
            setPendingMemories(prev => prev.filter(p => p.id !== id));
        }
    };

    const handleConfirmAll = async () => {
        const res = await window.electron.advancedMemory.confirmAll();
        if (res.success) {
            void loadData();
        }
    };

    const handleRejectAll = async () => {
        const res = await window.electron.advancedMemory.rejectAll();
        if (res.success) {
            setPendingMemories([]);
        }
    };

    const handleDelete = async (id: string) => {
        const res = await window.electron.advancedMemory.delete(id);
        if (res.success) {
            setConfirmedMemories(prev => prev.filter(m => m.id !== id));
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) { return; }
        const res = await window.electron.advancedMemory.deleteMany(Array.from(selectedIds));
        if (res.success) {
            setConfirmedMemories(prev => prev.filter(m => !selectedIds.has(m.id)));
            setSelectedIds(new Set());
            void loadData();
        }
    };

    const handleArchive = async (id: string) => {
        const res = await window.electron.advancedMemory.archive(id);
        if (res.success) {
            void loadData();
        }
    };

    const handleArchiveSelected = async () => {
        if (selectedIds.size === 0) { return; }
        const res = await window.electron.advancedMemory.archiveMany(Array.from(selectedIds));
        if (res.success) {
            setSelectedIds(new Set());
            void loadData();
        }
    };

    const handleRestore = async (id: string) => {
        const res = await window.electron.advancedMemory.restore(id);
        if (res.success) {
            void loadData();
        }
    };

    const handleRunDecay = async () => {
        await window.electron.advancedMemory.runDecay();
        void loadData();
    };

    return {
        isLoading,
        error,
        pendingMemories,
        setPendingMemories,
        confirmedMemories,
        setConfirmedMemories,
        stats,
        selectedIds,
        setSelectedIds,
        loadData,
        handleConfirm,
        handleReject,
        handleConfirmAll,
        handleRejectAll,
        handleDelete,
        handleDeleteSelected,
        handleArchive,
        handleArchiveSelected,
        handleRestore,
        handleRunDecay
    };
}
