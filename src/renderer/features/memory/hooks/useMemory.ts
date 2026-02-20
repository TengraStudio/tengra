import {
    AdvancedSemanticFragment,
    MemoryCategory,
    MemorySearchAnalytics,
    MemoryStatistics,
    PendingMemory
} from '@shared/types/advanced-memory';
import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
import { recordMemoryInspectorHealthEvent } from '@/store/memory-inspector-health.store';

import {
    memoryInspectorErrorCodes,
    parseAndValidateMemoryImportPayload,
    validateMemoryId,
    validateMemorySearchQuery,
} from '../utils/memory-inspector-validation';

type TabType = 'pending' | 'confirmed' | 'archived' | 'stats' | 'visualization';

interface UseMemoryReturn {
    // Data
    pendingMemories: PendingMemory[];
    confirmedMemories: AdvancedSemanticFragment[];
    stats: MemoryStatistics | null;
    searchAnalytics: MemorySearchAnalytics | null;
    contextPreview: AdvancedSemanticFragment[];
    isLoading: boolean;
    error: string | null;
    lastErrorCode: string | null;

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
    handleExport: () => Promise<void>;
    handleImport: (fileContent: string, replaceExisting: boolean) => Promise<void>;
    handleShare: (memoryId: string, targetProjectId: string) => Promise<void>;
    handleRecategorize: (ids?: string[]) => Promise<void>;
    getHistory: (id: string) => Promise<import('@shared/types/advanced-memory').MemoryVersion[]>;
    handleRollback: (id: string, versionIndex: number) => Promise<void>;
}

export function useMemory(searchQuery: string, activeTab: TabType): UseMemoryReturn {
    const { t } = useTranslation();
    const unexpectedMessage = t('errors.unexpected');
    const exportFailedMessage = t('memory.errors.exportFailed');
    const importFailedMessage = t('memory.errors.importFailed');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);
    const [pendingMemories, setPendingMemories] = useState<PendingMemory[]>([]);
    const [confirmedMemories, setConfirmedMemories] = useState<AdvancedSemanticFragment[]>([]);
    const [stats, setStats] = useState<MemoryStatistics | null>(null);
    const [searchAnalytics, setSearchAnalytics] = useState<MemorySearchAnalytics | null>(null);
    const [contextPreview, setContextPreview] = useState<AdvancedSemanticFragment[]>([]);

    const setHookError = useCallback((errorCode: string, message: string) => {
        setLastErrorCode(errorCode);
        setError(message);
    }, []);

    const loadData = useCallback(async () => {
        const startedAt = Date.now();
        setIsLoading(true);
        setError(null);
        setLastErrorCode(null);

        if (!validateMemorySearchQuery(searchQuery)) {
            const errorCode = memoryInspectorErrorCodes.validation;
            setHookError(errorCode, unexpectedMessage);
            recordMemoryInspectorHealthEvent({
                channel: 'memory.loadData',
                status: 'validation-failure',
                durationMs: Date.now() - startedAt,
                errorCode,
            });
            setIsLoading(false);
            return;
        }

        const maxAttempts = 2;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                const [pendingRes, statsRes, analyticsRes, contextRes] = await Promise.all([
                    window.electron.advancedMemory.getPending(),
                    window.electron.advancedMemory.getStats(),
                    window.electron.advancedMemory.getSearchAnalytics(),
                    window.electron.advancedMemory.recall({
                        query: searchQuery,
                        limit: 8,
                        includeArchived: activeTab === 'archived'
                    })
                ]);

                if (pendingRes.success) { setPendingMemories(pendingRes.data); }
                if (statsRes.success && statsRes.data) { setStats(statsRes.data); }
                if (analyticsRes.success) { setSearchAnalytics(analyticsRes.data); }
                if (contextRes.success) { setContextPreview(contextRes.data.memories); }

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

                recordMemoryInspectorHealthEvent({
                    channel: 'memory.loadData',
                    status: 'success',
                    durationMs: Date.now() - startedAt,
                });
                setIsLoading(false);
                return;
            } catch (err) {
                if (attempt === maxAttempts) {
                    const errorCode = memoryInspectorErrorCodes.loadFailed;
                    setHookError(errorCode, String(err));
                    recordMemoryInspectorHealthEvent({
                        channel: 'memory.loadData',
                        status: 'failure',
                        durationMs: Date.now() - startedAt,
                        errorCode,
                    });
                }
            }
        }
        setIsLoading(false);
    }, [activeTab, searchQuery, setHookError, unexpectedMessage]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadData();
        }, 0);
        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [loadData]);

    const recordOperationFailure = useCallback((errorCode: string, message: string, startedAt: number) => {
        setHookError(errorCode, message);
        recordMemoryInspectorHealthEvent({
            channel: 'memory.operation',
            status: 'failure',
            durationMs: Date.now() - startedAt,
            errorCode,
        });
    }, [setHookError]);

    const handleConfirm = useCallback(async (id: string) => {
        const startedAt = Date.now();
        if (!validateMemoryId(id)) {
            const errorCode = memoryInspectorErrorCodes.validation;
            setHookError(errorCode, unexpectedMessage);
            recordMemoryInspectorHealthEvent({
                channel: 'memory.operation',
                status: 'validation-failure',
                durationMs: Date.now() - startedAt,
                errorCode,
            });
            return;
        }
        const res = await window.electron.advancedMemory.confirm(id);
        if (res.success) {
            setPendingMemories(prev => prev.filter(p => p.id !== id));
            void loadData();
            recordMemoryInspectorHealthEvent({
                channel: 'memory.operation',
                status: 'success',
                durationMs: Date.now() - startedAt,
            });
            return;
        }
        recordOperationFailure(
            memoryInspectorErrorCodes.operationFailed,
            unexpectedMessage,
            startedAt
        );
    }, [loadData, recordOperationFailure, setHookError, unexpectedMessage]);

    const handleReject = useCallback(async (id: string) => {
        const startedAt = Date.now();
        if (!validateMemoryId(id)) {
            const errorCode = memoryInspectorErrorCodes.validation;
            setHookError(errorCode, unexpectedMessage);
            recordMemoryInspectorHealthEvent({
                channel: 'memory.operation',
                status: 'validation-failure',
                durationMs: Date.now() - startedAt,
                errorCode,
            });
            return;
        }
        const res = await window.electron.advancedMemory.reject(id);
        if (res.success) {
            setPendingMemories(prev => prev.filter(p => p.id !== id));
            recordMemoryInspectorHealthEvent({
                channel: 'memory.operation',
                status: 'success',
                durationMs: Date.now() - startedAt,
            });
            return;
        }
        recordOperationFailure(
            memoryInspectorErrorCodes.operationFailed,
            unexpectedMessage,
            startedAt
        );
    }, [recordOperationFailure, setHookError, unexpectedMessage]);

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
        const startedAt = Date.now();
        if (!validateMemoryId(id)) {
            const errorCode = memoryInspectorErrorCodes.validation;
            setHookError(errorCode, unexpectedMessage);
            recordMemoryInspectorHealthEvent({
                channel: 'memory.operation',
                status: 'validation-failure',
                durationMs: Date.now() - startedAt,
                errorCode,
            });
            return;
        }
        const res = await window.electron.advancedMemory.delete(id);
        if (res.success) {
            setConfirmedMemories(prev => prev.filter(m => m.id !== id));
            setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
            recordMemoryInspectorHealthEvent({
                channel: 'memory.operation',
                status: 'success',
                durationMs: Date.now() - startedAt,
            });
            return;
        }
        recordOperationFailure(
            memoryInspectorErrorCodes.operationFailed,
            unexpectedMessage,
            startedAt
        );
    }, [recordOperationFailure, setHookError, unexpectedMessage]);

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

    const handleExport = useCallback(async () => {
        const startedAt = Date.now();
        const exportRes = await window.electron.advancedMemory.export(searchQuery || undefined, 500);
        if (!exportRes.success || !exportRes.data) {
            const errorCode = memoryInspectorErrorCodes.operationFailed;
            setHookError(errorCode, exportRes.error ?? exportFailedMessage);
            recordMemoryInspectorHealthEvent({
                channel: 'memory.operation',
                status: 'failure',
                durationMs: Date.now() - startedAt,
                errorCode,
            });
            return;
        }

        const payload = JSON.stringify(exportRes.data, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `memory-export-${Date.now()}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        recordMemoryInspectorHealthEvent({
            channel: 'memory.operation',
            status: 'success',
            durationMs: Date.now() - startedAt,
        });
    }, [exportFailedMessage, searchQuery, setHookError]);

    const handleImport = useCallback(async (fileContent: string, replaceExisting: boolean) => {
        const startedAt = Date.now();
        const validation = parseAndValidateMemoryImportPayload(fileContent, replaceExisting);
        if (!validation.success) {
            const message = validation.messageKey === 'memory.errors.importFailed'
                ? importFailedMessage
                : unexpectedMessage;
            setHookError(validation.errorCode, message);
            recordMemoryInspectorHealthEvent({
                channel: 'memory.import',
                status: 'validation-failure',
                durationMs: Date.now() - startedAt,
                errorCode: validation.errorCode,
            });
            return;
        }
        try {
            const importRes = await window.electron.advancedMemory.import(validation.payload);
            if (!importRes.success) {
                const errorCode = memoryInspectorErrorCodes.importFailed;
                setHookError(errorCode, importRes.error ?? importFailedMessage);
                recordMemoryInspectorHealthEvent({
                    channel: 'memory.import',
                    status: 'failure',
                    durationMs: Date.now() - startedAt,
                    errorCode,
                });
                return;
            }

            await loadData();
            recordMemoryInspectorHealthEvent({
                channel: 'memory.import',
                status: 'success',
                durationMs: Date.now() - startedAt,
            });
        } catch (importError) {
            const errorCode = memoryInspectorErrorCodes.importFailed;
            setHookError(errorCode, `${importFailedMessage}: ${String(importError)}`);
            recordMemoryInspectorHealthEvent({
                channel: 'memory.import',
                status: 'failure',
                durationMs: Date.now() - startedAt,
                errorCode,
            });
        }
    }, [importFailedMessage, loadData, setHookError, unexpectedMessage]);

    const handleShare = useCallback(async (memoryId: string, targetProjectId: string) => {
        const res = await window.electron.advancedMemory.shareWithProject(memoryId, targetProjectId);
        if (res.success) { void loadData(); }
    }, [loadData]);

    const handleRecategorize = useCallback(async (ids?: string[]) => {
        const res = await window.electron.advancedMemory.recategorize(ids);
        if (res.success) { void loadData(); }
    }, [loadData]);

    const getHistory = useCallback(async (id: string) => {
        const res = await window.electron.advancedMemory.getHistory(id);
        return res.success ? res.data : [];
    }, []);

    const handleRollback = useCallback(async (id: string, versionIndex: number) => {
        const res = await window.electron.advancedMemory.rollback(id, versionIndex);
        if (res.success) { void loadData(); }
    }, [loadData]);

    return {
        pendingMemories, confirmedMemories, stats, searchAnalytics, contextPreview, isLoading, error, lastErrorCode,
        setPendingMemories, setConfirmedMemories, loadData,
        handleConfirm, handleReject, handleConfirmAll, handleRejectAll, handleRunDecay,
        handleDelete, handleDeleteSelected, handleArchive, handleArchiveSelected, handleRestore,
        handleExport, handleImport, handleShare, handleRecategorize, getHistory, handleRollback
    };
}

// Edit modal state hook
interface EditModalState {
    editingMemory: AdvancedSemanticFragment | null;
    editContent: string;
    editCategory: MemoryCategory;
    editTags: string;
    editImportance: number;
    editExpiresAt: string;
}

interface UseEditModalReturn extends EditModalState {
    setEditContent: (content: string) => void;
    setEditCategory: (category: MemoryCategory) => void;
    setEditTags: (tags: string) => void;
    setEditImportance: (importance: number) => void;
    setEditExpiresAt: (expiresAt: string) => void;
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
    const [editExpiresAt, setEditExpiresAt] = useState('');

    const openEditModal = useCallback((memory: AdvancedSemanticFragment) => {
        setEditingMemory(memory);
        setEditContent(memory.content);
        setEditCategory(memory.category);
        setEditTags(memory.tags.join(', '));
        setEditImportance(memory.importance);
        setEditExpiresAt(memory.expiresAt ? new Date(memory.expiresAt).toISOString().split('T')[0] : '');
    }, []);

    const closeEditModal = useCallback(() => { setEditingMemory(null); }, []);

    const handleSaveEdit = useCallback(async (loadData: () => Promise<void>) => {
        if (!editingMemory) { return; }
        const res = await window.electron.advancedMemory.edit(editingMemory.id, {
            content: editContent,
            category: editCategory,
            tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
            importance: editImportance,
            projectId: editingMemory.projectId,
            expiresAt: editExpiresAt ? new Date(editExpiresAt).getTime() : undefined
        });
        if (res.success) {
            setEditingMemory(null);
            void loadData();
        }
    }, [editingMemory, editContent, editCategory, editTags, editImportance, editExpiresAt]);

    return {
        editingMemory, editContent, editCategory, editTags, editImportance, editExpiresAt,
        setEditContent, setEditCategory, setEditTags, setEditImportance, setEditExpiresAt,
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
