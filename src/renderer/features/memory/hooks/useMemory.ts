import { AdvancedSemanticFragment, MemoryCategory, MemoryStatistics, PendingMemory } from '@shared/types/advanced-memory';
import { useCallback, useEffect, useState } from 'react';

type TabType = 'pending' | 'confirmed' | 'archived' | 'stats';

interface UseMemoryReturn {
    // Data
    pendingMemories: PendingMemory[];
    confirmedMemories: AdvancedSemanticFragment[];
    stats: MemoryStatistics | null;
    isLoading: boolean;
    error: string | null;

    // Setters
    setPendingMemories: React.Dispatch<React.SetStateAction<PendingMemory[]>>;
    setConfirmedMemories: React.Dispatch<React.SetStateAction<AdvancedSemanticFragment[]>>;

    // Actions
    loadData: () => Promise<void>;
    handleConfirm: (id: string) => Promise<void>;
    handleReject: (id: string) => Promise<void>;
    handleConfirmAll: () => Promise<void>;
    handleRejectAll: () => Promise<void>;
    handleRunDecay: () => Promise<void>;
    handleDelete: (id: string, setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>) => Promise<void>;
    handleDeleteSelected: (selectedIds: Set<string>, setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>) => Promise<void>;
    handleArchive: (id: string) => Promise<void>;
    handleArchiveSelected: (selectedIds: Set<string>, setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>) => Promise<void>;
    handleRestore: (id: string) => Promise<void>;
}

export function useMemory(searchQuery: string, activeTab: TabType): UseMemoryReturn {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingMemories, setPendingMemories] = useState<PendingMemory[]>([]);
    const [confirmedMemories, setConfirmedMemories] = useState<AdvancedSemanticFragment[]>([]);
    const [stats, setStats] = useState<MemoryStatistics | null>(null);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [pendingRes, statsRes] = await Promise.all([
                window.electron.advancedMemory.getPending(),
                window.electron.advancedMemory.getStats()
            ]);

            if (pendingRes.success) { setPendingMemories(pendingRes.data); }
            if (statsRes.success && statsRes.data) { setStats(statsRes.data); }

            if (searchQuery) {
                const searchRes = await window.electron.advancedMemory.search(searchQuery, 50);
                if (searchRes.success) { setConfirmedMemories(searchRes.data); }
            } else {
                const recallRes = await window.electron.advancedMemory.recall({
                    query: '',
                    limit: 100,
                    includeArchived: activeTab === 'archived'
                });
                if (recallRes.success) { setConfirmedMemories(recallRes.data.memories); }
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setIsLoading(false);
        }
    }, [searchQuery, activeTab]);

    useEffect(() => { void loadData(); }, [loadData]);

    const handleConfirm = useCallback(async (id: string) => {
        const res = await window.electron.advancedMemory.confirm(id);
        if (res.success) {
            setPendingMemories(prev => prev.filter(p => p.id !== id));
            void loadData();
        }
    }, [loadData]);

    const handleReject = useCallback(async (id: string) => {
        const res = await window.electron.advancedMemory.reject(id);
        if (res.success) { setPendingMemories(prev => prev.filter(p => p.id !== id)); }
    }, []);

    const handleConfirmAll = useCallback(async () => {
        const res = await window.electron.advancedMemory.confirmAll();
        if (res.success) { void loadData(); }
    }, [loadData]);

    const handleRejectAll = useCallback(async () => {
        const res = await window.electron.advancedMemory.rejectAll();
        if (res.success) { setPendingMemories([]); }
    }, []);

    const handleRunDecay = useCallback(async () => {
        await window.electron.advancedMemory.runDecay();
        void loadData();
    }, [loadData]);

    const handleDelete = useCallback(async (id: string, setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>) => {
        const res = await window.electron.advancedMemory.delete(id);
        if (res.success) {
            setConfirmedMemories(prev => prev.filter(m => m.id !== id));
            setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        }
    }, []);

    const handleDeleteSelected = useCallback(async (selectedIds: Set<string>, setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>) => {
        if (selectedIds.size === 0) { return; }
        const res = await window.electron.advancedMemory.deleteMany(Array.from(selectedIds));
        if (res.success) {
            setConfirmedMemories(prev => prev.filter(m => !selectedIds.has(m.id)));
            setSelectedIds(new Set());
            void loadData();
        }
    }, [loadData]);

    const handleArchive = useCallback(async (id: string) => {
        const res = await window.electron.advancedMemory.archive(id);
        if (res.success) { void loadData(); }
    }, [loadData]);

    const handleArchiveSelected = useCallback(async (selectedIds: Set<string>, setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>) => {
        if (selectedIds.size === 0) { return; }
        const res = await window.electron.advancedMemory.archiveMany(Array.from(selectedIds));
        if (res.success) { setSelectedIds(new Set()); void loadData(); }
    }, [loadData]);

    const handleRestore = useCallback(async (id: string) => {
        const res = await window.electron.advancedMemory.restore(id);
        if (res.success) { void loadData(); }
    }, [loadData]);

    return {
        pendingMemories, confirmedMemories, stats, isLoading, error,
        setPendingMemories, setConfirmedMemories, loadData,
        handleConfirm, handleReject, handleConfirmAll, handleRejectAll, handleRunDecay,
        handleDelete, handleDeleteSelected, handleArchive, handleArchiveSelected, handleRestore
    };
}

// Edit modal state hook
interface EditModalState {
    editingMemory: AdvancedSemanticFragment | null;
    editContent: string;
    editCategory: MemoryCategory;
    editTags: string;
    editImportance: number;
}

interface UseEditModalReturn extends EditModalState {
    setEditContent: (content: string) => void;
    setEditCategory: (category: MemoryCategory) => void;
    setEditTags: (tags: string) => void;
    setEditImportance: (importance: number) => void;
    openEditModal: (memory: AdvancedSemanticFragment) => void;
    closeEditModal: () => void;
    handleSaveEdit: (loadData: () => Promise<void>) => Promise<void>;
}

export function useEditModal(): UseEditModalReturn {
    const [editingMemory, setEditingMemory] = useState<AdvancedSemanticFragment | null>(null);
    const [editContent, setEditContent] = useState('');
    const [editCategory, setEditCategory] = useState<MemoryCategory>('fact');
    const [editTags, setEditTags] = useState('');
    const [editImportance, setEditImportance] = useState(0.5);

    const openEditModal = useCallback((memory: AdvancedSemanticFragment) => {
        setEditingMemory(memory);
        setEditContent(memory.content);
        setEditCategory(memory.category);
        setEditTags(memory.tags.join(', '));
        setEditImportance(memory.importance);
    }, []);

    const closeEditModal = useCallback(() => { setEditingMemory(null); }, []);

    const handleSaveEdit = useCallback(async (loadData: () => Promise<void>) => {
        if (!editingMemory) { return; }
        const res = await window.electron.advancedMemory.edit(editingMemory.id, {
            content: editContent,
            category: editCategory,
            tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
            importance: editImportance
        });
        if (res.success) { setEditingMemory(null); void loadData(); }
    }, [editingMemory, editContent, editCategory, editTags, editImportance]);

    return {
        editingMemory, editContent, editCategory, editTags, editImportance,
        setEditContent, setEditCategory, setEditTags, setEditImportance,
        openEditModal, closeEditModal, handleSaveEdit
    };
}

// Add modal state hook
interface UseAddModalReturn {
    showAddMemory: boolean;
    newMemoryContent: string;
    newMemoryCategory: MemoryCategory;
    newMemoryTags: string;
    setShowAddMemory: (show: boolean) => void;
    setNewMemoryContent: (content: string) => void;
    setNewMemoryCategory: (category: MemoryCategory) => void;
    setNewMemoryTags: (tags: string) => void;
    handleAddMemory: (loadData: () => Promise<void>) => Promise<void>;
}

export function useAddModal(): UseAddModalReturn {
    const [showAddMemory, setShowAddMemory] = useState(false);
    const [newMemoryContent, setNewMemoryContent] = useState('');
    const [newMemoryCategory, setNewMemoryCategory] = useState<MemoryCategory>('fact');
    const [newMemoryTags, setNewMemoryTags] = useState('');

    const handleAddMemory = useCallback(async (loadData: () => Promise<void>) => {
        if (!newMemoryContent.trim()) { return; }
        const res = await window.electron.advancedMemory.remember(newMemoryContent, {
            category: newMemoryCategory,
            tags: newMemoryTags.split(',').map(t => t.trim()).filter(Boolean)
        });
        if (res.success) {
            setShowAddMemory(false);
            setNewMemoryContent('');
            setNewMemoryCategory('fact');
            setNewMemoryTags('');
            void loadData();
        }
    }, [newMemoryContent, newMemoryCategory, newMemoryTags]);

    return {
        showAddMemory, newMemoryContent, newMemoryCategory, newMemoryTags,
        setShowAddMemory, setNewMemoryContent, setNewMemoryCategory, setNewMemoryTags,
        handleAddMemory
    };
}
