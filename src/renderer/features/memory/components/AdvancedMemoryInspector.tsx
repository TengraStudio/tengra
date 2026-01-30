/**
 * Advanced Memory Inspector
 *
 * A sophisticated UI for the advanced memory system with:
 * - Pending memories (staging buffer) with validation controls
 * - Memory statistics and health metrics
 * - Category filtering and context-aware search
 * - Contradiction and similarity indicators
 * - Delete, edit, and bulk operations
 */

import { useTranslation } from '@renderer/i18n';
import {
    AdvancedSemanticFragment,
    MemoryCategory,
    MemoryStatistics,
    PendingMemory
} from '@shared/types/advanced-memory';
import { formatDistanceToNow } from 'date-fns';
import { LucideIcon } from 'lucide-react';
import {
    AlertTriangle,
    Archive,
    ArrowRight,
    Brain,
    Check,
    CheckCircle,
    CheckSquare,
    ChevronDown,
    Clock,
    Edit3,
    Filter,
    Gauge,
    GitMerge,
    HelpCircle,
    Lightbulb,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Settings,
    Sparkles,
    Square,
    Tag,
    Trash2,
    TrendingDown,
    X,
    Zap
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/LoadingState';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';

type TabType = 'pending' | 'confirmed' | 'archived' | 'stats';

const CATEGORY_CONFIG: Record<MemoryCategory, { label: string; color: string; icon: LucideIcon }> = {
    preference: { label: 'Preference', color: 'bg-primary/10 text-primary', icon: Settings },
    personal: { label: 'Personal', color: 'bg-pink/10 text-pink', icon: Brain },
    project: { label: 'Project', color: 'bg-success/10 text-success', icon: Lightbulb },
    technical: { label: 'Technical', color: 'bg-orange/10 text-orange', icon: Zap },
    workflow: { label: 'Workflow', color: 'bg-purple/10 text-purple', icon: ArrowRight },
    relationship: { label: 'Relationship', color: 'bg-cyan/10 text-cyan', icon: GitMerge },
    fact: { label: 'Fact', color: 'bg-muted/10 text-muted-foreground', icon: HelpCircle },
    instruction: { label: 'Instruction', color: 'bg-yellow/10 text-yellow', icon: Sparkles },
};

export const AdvancedMemoryInspector: React.FC = () => {
    const { t } = useTranslation();

    // State
    const [activeTab, setActiveTab] = useState<TabType>('pending');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<MemoryCategory | 'all'>('all');

    // Data
    const [pendingMemories, setPendingMemories] = useState<PendingMemory[]>([]);
    const [confirmedMemories, setConfirmedMemories] = useState<AdvancedSemanticFragment[]>([]);
    const [stats, setStats] = useState<MemoryStatistics | null>(null);

    // Selection state for bulk operations
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Edit modal state
    const [editingMemory, setEditingMemory] = useState<AdvancedSemanticFragment | null>(null);
    const [editContent, setEditContent] = useState('');
    const [editCategory, setEditCategory] = useState<MemoryCategory>('fact');
    const [editTags, setEditTags] = useState('');
    const [editImportance, setEditImportance] = useState(0.5);

    // Add memory modal state
    const [showAddMemory, setShowAddMemory] = useState(false);
    const [newMemoryContent, setNewMemoryContent] = useState('');
    const [newMemoryCategory, setNewMemoryCategory] = useState<MemoryCategory>('fact');
    const [newMemoryTags, setNewMemoryTags] = useState('');

    // Load data
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

            // Load confirmed memories via search
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

    // Clear selection when switching tabs
    useEffect(() => {
        setSelectedIds(new Set());
    }, [activeTab]);

    // Actions
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

    const handleRunDecay = async () => {
        await window.electron.advancedMemory.runDecay();
        void loadData();
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        void loadData();
    };

    // Delete single memory
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

    // Delete selected memories
    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) { return; }
        const res = await window.electron.advancedMemory.deleteMany(Array.from(selectedIds));
        if (res.success) {
            setConfirmedMemories(prev => prev.filter(m => !selectedIds.has(m.id)));
            setSelectedIds(new Set());
            void loadData();
        }
    };

    // Archive single memory
    const handleArchive = async (id: string) => {
        const res = await window.electron.advancedMemory.archive(id);
        if (res.success) {
            void loadData();
        }
    };

    // Archive selected memories
    const handleArchiveSelected = async () => {
        if (selectedIds.size === 0) { return; }
        const res = await window.electron.advancedMemory.archiveMany(Array.from(selectedIds));
        if (res.success) {
            setSelectedIds(new Set());
            void loadData();
        }
    };

    // Restore archived memory
    const handleRestore = async (id: string) => {
        const res = await window.electron.advancedMemory.restore(id);
        if (res.success) {
            void loadData();
        }
    };

    // Open edit modal
    const openEditModal = (memory: AdvancedSemanticFragment) => {
        setEditingMemory(memory);
        setEditContent(memory.content);
        setEditCategory(memory.category);
        setEditTags(memory.tags.join(', '));
        setEditImportance(memory.importance);
    };

    // Save edit
    const handleSaveEdit = async () => {
        if (!editingMemory) { return; }

        const res = await window.electron.advancedMemory.edit(editingMemory.id, {
            content: editContent,
            category: editCategory,
            tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
            importance: editImportance
        });

        if (res.success) {
            setEditingMemory(null);
            void loadData();
        }
    };

    // Add new memory
    const handleAddMemory = async () => {
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
    };

    // Toggle selection
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Select all visible
    const selectAll = () => {
        const ids = filteredConfirmed.map(m => m.id);
        setSelectedIds(new Set(ids));
    };

    // Clear selection
    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    // Filter memories
    const filteredConfirmed = confirmedMemories.filter(m => {
        if (categoryFilter !== 'all' && m.category !== categoryFilter) { return false; }
        if (activeTab === 'archived' && m.status !== 'archived') { return false; }
        if (activeTab === 'confirmed' && m.status !== 'confirmed') { return false; }
        return true;
    });

    const filteredPending = pendingMemories.filter(m => {
        if (categoryFilter !== 'all' && m.suggestedCategory !== categoryFilter) { return false; }
        return true;
    });

    if (isLoading && pendingMemories.length === 0 && confirmedMemories.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center bg-background/50 backdrop-blur-xl">
                <LoadingState size="lg" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-background/50 backdrop-blur-xl overflow-hidden p-6 gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
                        Advanced Memory
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Intelligent memory with validation, decay, and context-aware recall.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => void loadData()} className="gap-2">
                        <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                        Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void handleRunDecay()} className="gap-2">
                        <TrendingDown className="w-4 h-4" />
                        Run Decay
                    </Button>
                    <Button size="sm" onClick={() => setShowAddMemory(true)} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Add Memory
                    </Button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <StatCard
                        label="Pending"
                        value={stats.pendingValidation}
                        icon={Clock}
                        color="text-yellow"
                        highlight={stats.pendingValidation > 0}
                    />
                    <StatCard
                        label="Confirmed"
                        value={stats.byStatus.confirmed}
                        icon={CheckCircle}
                        color="text-success"
                    />
                    <StatCard
                        label="Archived"
                        value={stats.byStatus.archived}
                        icon={Archive}
                        color="text-muted-foreground"
                    />
                    <StatCard
                        label="Avg. Confidence"
                        value={`${(stats.averageConfidence * 100).toFixed(0)}%`}
                        icon={Gauge}
                        color="text-primary"
                    />
                    <StatCard
                        label="Contradictions"
                        value={stats.contradictions}
                        icon={AlertTriangle}
                        color="text-orange"
                        highlight={stats.contradictions > 0}
                    />
                </div>
            )}

            {/* Search & Filters */}
            <div className="flex gap-4 items-center">
                <form onSubmit={handleSearch} className="flex gap-2 items-center flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                        <Input
                            placeholder="Search memories..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-muted/30 border-white/5"
                        />
                    </div>
                    <Button type="submit" variant="secondary">Search</Button>
                </form>

                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as MemoryCategory | 'all')}>
                        <SelectTrigger className="w-[180px] bg-muted/30 border-white/5">
                            <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                <SelectItem key={key} value={key}>
                                    <span className="flex items-center gap-2">
                                        <config.icon className="w-4 h-4" />
                                        {config.label}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Content Tabs */}
            <div className="flex-1 flex flex-col gap-4 min-h-0">
                <div className="flex items-center justify-between">
                    <div className="flex gap-1 p-1 bg-muted/30 rounded-lg w-fit border border-white/5">
                        {[
                            { id: 'pending' as TabType, label: 'Pending', icon: Clock, count: pendingMemories.length },
                            { id: 'confirmed' as TabType, label: 'Confirmed', icon: CheckCircle, count: stats?.byStatus.confirmed ?? 0 },
                            { id: 'archived' as TabType, label: 'Archived', icon: Archive, count: stats?.byStatus.archived ?? 0 },
                            { id: 'stats' as TabType, label: 'Statistics', icon: Gauge },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                                    activeTab === tab.id
                                        ? "bg-primary text-primary-foreground shadow-lg"
                                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                )}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
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

                    {/* Bulk actions */}
                    <div className="flex gap-2">
                        {activeTab === 'pending' && pendingMemories.length > 0 && (
                            <>
                                <Button variant="outline" size="sm" onClick={() => void handleConfirmAll()} className="gap-2">
                                    <Check className="w-4 h-4" />
                                    Confirm All
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => void handleRejectAll()} className="gap-2 text-destructive hover:text-destructive">
                                    <X className="w-4 h-4" />
                                    Reject All
                                </Button>
                            </>
                        )}

                        {(activeTab === 'confirmed' || activeTab === 'archived') && filteredConfirmed.length > 0 && (
                            <>
                                {selectedIds.size > 0 ? (
                                    <>
                                        <span className="text-sm text-muted-foreground flex items-center">
                                            {selectedIds.size} selected
                                        </span>
                                        <Button variant="ghost" size="sm" onClick={clearSelection} className="gap-2">
                                            <X className="w-4 h-4" />
                                            Clear
                                        </Button>
                                        {activeTab === 'confirmed' && (
                                            <Button variant="outline" size="sm" onClick={() => void handleArchiveSelected()} className="gap-2">
                                                <Archive className="w-4 h-4" />
                                                Archive
                                            </Button>
                                        )}
                                        <Button variant="destructive" size="sm" onClick={() => void handleDeleteSelected()} className="gap-2">
                                            <Trash2 className="w-4 h-4" />
                                            Delete
                                        </Button>
                                    </>
                                ) : (
                                    <Button variant="outline" size="sm" onClick={selectAll} className="gap-2">
                                        <CheckSquare className="w-4 h-4" />
                                        Select All
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="flex-1 min-h-0">
                    <ScrollArea className="h-full">
                        <div className="grid grid-cols-1 gap-4 pb-6">
                            {activeTab === 'pending' && (
                                <>
                                    {filteredPending.length === 0 ? (
                                        <EmptyState
                                            icon={Clock}
                                            title="No Pending Memories"
                                            description="Extracted facts will appear here for your validation."
                                        />
                                    ) : (
                                        filteredPending.map(memory => (
                                            <PendingMemoryCard
                                                key={memory.id}
                                                memory={memory}
                                                onConfirm={() => void handleConfirm(memory.id)}
                                                onReject={() => void handleReject(memory.id)}
                                            />
                                        ))
                                    )}
                                </>
                            )}

                            {(activeTab === 'confirmed' || activeTab === 'archived') && (
                                <>
                                    {filteredConfirmed.length === 0 ? (
                                        <EmptyState
                                            icon={activeTab === 'archived' ? Archive : CheckCircle}
                                            title={activeTab === 'archived' ? "No Archived Memories" : "No Confirmed Memories"}
                                            description={activeTab === 'archived'
                                                ? "Low-importance memories will be archived over time."
                                                : "Confirm pending memories to see them here."
                                            }
                                        />
                                    ) : (
                                        filteredConfirmed.map(memory => (
                                            <ConfirmedMemoryCard
                                                key={memory.id}
                                                memory={memory}
                                                isSelected={selectedIds.has(memory.id)}
                                                onToggleSelect={() => toggleSelect(memory.id)}
                                                onEdit={() => openEditModal(memory)}
                                                onDelete={() => void handleDelete(memory.id)}
                                                onArchive={() => void handleArchive(memory.id)}
                                                onRestore={() => void handleRestore(memory.id)}
                                            />
                                        ))
                                    )}
                                </>
                            )}

                            {activeTab === 'stats' && stats && (
                                <StatsPanel stats={stats} />
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>

            {/* Edit Memory Modal */}
            {editingMemory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-lg p-6 bg-popover/90 backdrop-blur-2xl border-white/10 shadow-2xl space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Edit3 className="w-5 h-5 text-primary" />
                            Edit Memory
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Content</label>
                                <textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="w-full h-24 mt-1 bg-muted/50 border border-white/5 rounded-lg p-3 text-sm focus:border-primary/50 outline-none resize-none transition-colors"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Category</label>
                                    <Select value={editCategory} onValueChange={(v) => setEditCategory(v as MemoryCategory)}>
                                        <SelectTrigger className="mt-1 bg-muted/50 border-white/5">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                                <SelectItem key={key} value={key}>
                                                    <span className="flex items-center gap-2">
                                                        <config.icon className="w-4 h-4" />
                                                        {config.label}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Importance ({Math.round(editImportance * 100)}%)</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={editImportance}
                                        onChange={(e) => setEditImportance(parseFloat(e.target.value))}
                                        className="w-full mt-3"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Tags (comma-separated)</label>
                                <Input
                                    value={editTags}
                                    onChange={(e) => setEditTags(e.target.value)}
                                    placeholder="tag1, tag2, tag3"
                                    className="mt-1 bg-muted/50 border-white/5"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="ghost" onClick={() => setEditingMemory(null)}>Cancel</Button>
                            <Button onClick={() => void handleSaveEdit()} disabled={!editContent.trim()}>Save Changes</Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Add Memory Modal */}
            {showAddMemory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-lg p-6 bg-popover/90 backdrop-blur-2xl border-white/10 shadow-2xl space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Plus className="w-5 h-5 text-primary" />
                            Add Memory
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Content</label>
                                <textarea
                                    value={newMemoryContent}
                                    onChange={(e) => setNewMemoryContent(e.target.value)}
                                    placeholder="Enter what you want to remember..."
                                    className="w-full h-24 mt-1 bg-muted/50 border border-white/5 rounded-lg p-3 text-sm focus:border-primary/50 outline-none resize-none transition-colors"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Category</label>
                                    <Select value={newMemoryCategory} onValueChange={(v) => setNewMemoryCategory(v as MemoryCategory)}>
                                        <SelectTrigger className="mt-1 bg-muted/50 border-white/5">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                                <SelectItem key={key} value={key}>
                                                    <span className="flex items-center gap-2">
                                                        <config.icon className="w-4 h-4" />
                                                        {config.label}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Tags (comma-separated)</label>
                                    <Input
                                        value={newMemoryTags}
                                        onChange={(e) => setNewMemoryTags(e.target.value)}
                                        placeholder="tag1, tag2"
                                        className="mt-1 bg-muted/50 border-white/5"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="ghost" onClick={() => setShowAddMemory(false)}>Cancel</Button>
                            <Button onClick={() => void handleAddMemory()} disabled={!newMemoryContent.trim()}>Add Memory</Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// Sub-components
// ============================================================================

const StatCard = ({
    label,
    value,
    icon: Icon,
    color,
    highlight
}: {
    label: string;
    value: number | string;
    icon: LucideIcon;
    color: string;
    highlight?: boolean;
}) => (
    <Card className={cn(
        "p-4 bg-muted/30 border-white/5 flex flex-col gap-1 transition-all",
        highlight && "border-primary/30 bg-primary/5"
    )}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</p>
        <div className="flex items-end gap-2">
            <span className="text-2xl font-black">{value}</span>
            <Icon className={cn("w-4 h-4 mb-1", color)} />
        </div>
    </Card>
);

const PendingMemoryCard = ({
    memory,
    onConfirm,
    onReject
}: {
    memory: PendingMemory;
    onConfirm: () => void;
    onReject: () => void;
}) => {
    const [expanded, setExpanded] = useState(false);
    const config = CATEGORY_CONFIG[memory.suggestedCategory];

    return (
        <Card className="group p-4 bg-muted/20 border-white/5 hover:bg-muted/30 transition-all hover:border-yellow/30 relative overflow-hidden">
            {/* Confidence indicator */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{
                    background: `linear-gradient(to top,
                        hsl(${memory.extractionConfidence * 120}, 70%, 50%) 0%,
                        hsl(${memory.extractionConfidence * 120}, 70%, 50%) ${memory.extractionConfidence * 100}%,
                        transparent ${memory.extractionConfidence * 100}%)`
                }}
            />

            <div className="flex flex-col gap-3 pl-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Badge className={cn("border-none text-[10px] uppercase font-bold", config.color)}>
                            <config.icon className="w-3 h-3 mr-1" />
                            {config.label}
                        </Badge>
                        {memory.requiresUserValidation && (
                            <Badge variant="outline" className="border-yellow/30 text-yellow text-[10px]">
                                Needs Review
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onReject}
                            className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={onConfirm}
                            className="h-8 px-3 gap-1"
                        >
                            <Check className="w-4 h-4" />
                            Confirm
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <p className="text-sm leading-relaxed">{memory.content}</p>

                {/* Scores */}
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Gauge className="w-3 h-3" />
                        Confidence: {(memory.extractionConfidence * 100).toFixed(0)}%
                    </span>
                    <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Relevance: {(memory.relevanceScore * 100).toFixed(0)}%
                    </span>
                    <span className="flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" />
                        Novelty: {(memory.noveltyScore * 100).toFixed(0)}%
                    </span>
                </div>

                {/* Expandable details */}
                {(memory.potentialContradictions.length > 0 || memory.similarMemories.length > 0) && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ChevronDown className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")} />
                        {memory.potentialContradictions.length > 0 && (
                            <span className="text-orange">{memory.potentialContradictions.length} potential contradiction(s)</span>
                        )}
                        {memory.similarMemories.length > 0 && (
                            <span className="text-primary">{memory.similarMemories.length} similar memor{memory.similarMemories.length === 1 ? 'y' : 'ies'}</span>
                        )}
                    </button>
                )}

                {expanded && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                        {memory.potentialContradictions.map((c, i) => (
                            <div key={i} className="p-2 rounded bg-orange/10 text-[11px]">
                                <span className="text-orange font-bold">Contradiction: </span>
                                <span className="text-muted-foreground">{c.existingContent}</span>
                                <p className="mt-1 text-orange-300/70 italic">{c.conflictExplanation}</p>
                            </div>
                        ))}
                        {memory.similarMemories.map((s, i) => (
                            <div key={i} className="p-2 rounded bg-primary/10 text-[11px]">
                                <span className="text-primary font-bold">Similar ({(s.similarityScore * 100).toFixed(0)}%): </span>
                                <span className="text-muted-foreground">{s.content}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Tags & Meta */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                        {memory.suggestedTags.map((tag) => (
                            <span key={tag} className="flex items-center gap-1 text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-muted-foreground">
                                <Tag className="w-3 h-3" />
                                {tag}
                            </span>
                        ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground/50">
                        {formatDistanceToNow(new Date(memory.extractedAt))} ago
                    </span>
                </div>
            </div>
        </Card>
    );
};

const ConfirmedMemoryCard = ({
    memory,
    isSelected,
    onToggleSelect,
    onEdit,
    onDelete,
    onArchive,
    onRestore
}: {
    memory: AdvancedSemanticFragment;
    isSelected: boolean;
    onToggleSelect: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onArchive: () => void;
    onRestore: () => void;
}) => {
    const config = CATEGORY_CONFIG[memory.category];

    return (
        <Card className={cn(
            "group p-4 bg-muted/20 border-white/5 hover:bg-muted/30 transition-all relative overflow-hidden",
            memory.status === 'archived' && "opacity-60",
            isSelected && "border-primary/50 bg-primary/5"
        )}>
            {/* Importance indicator */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-t from-primary/20 to-primary"
                style={{ opacity: memory.importance }}
            />

            <div className="flex flex-col gap-2 pl-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {/* Selection checkbox */}
                        <button
                            onClick={onToggleSelect}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                        >
                            {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                                <Square className="w-4 h-4 text-muted-foreground/50" />
                            )}
                        </button>

                        <Badge className={cn("border-none text-[10px] uppercase font-bold", config.color)}>
                            <config.icon className="w-3 h-3 mr-1" />
                            {config.label}
                        </Badge>
                        {memory.status === 'archived' && (
                            <Badge variant="secondary" className="text-[10px]">
                                <Archive className="w-3 h-3 mr-1" />
                                Archived
                            </Badge>
                        )}
                        {memory.validatedBy === 'user' && (
                            <Badge variant="outline" className="border-success/30 text-success text-[10px]">
                                <Check className="w-3 h-3 mr-1" />
                                User Verified
                            </Badge>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onEdit}
                            className="h-7 w-7 p-0"
                            title="Edit"
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        {memory.status === 'archived' ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onRestore}
                                className="h-7 w-7 p-0"
                                title="Restore"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                        ) : (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onArchive}
                                className="h-7 w-7 p-0"
                                title="Archive"
                            >
                                <Archive className="w-3.5 h-3.5" />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onDelete}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            title="Delete"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>

                <p className="text-sm leading-relaxed">{memory.content}</p>

                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Gauge className="w-3 h-3" />
                        Importance: {(memory.importance * 100).toFixed(0)}%
                    </span>
                    <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Confidence: {(memory.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Accessed: {memory.accessCount}x
                    </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex flex-wrap gap-1">
                        {memory.tags.map((tag) => (
                            <span key={tag} className="flex items-center gap-1 text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-muted-foreground">
                                <Tag className="w-3 h-3" />
                                {tag}
                            </span>
                        ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground/50">
                        {formatDistanceToNow(new Date(memory.createdAt))} ago • {memory.source}
                    </span>
                </div>
            </div>
        </Card>
    );
};

const StatsPanel = ({ stats }: { stats: MemoryStatistics }) => (
    <div className="space-y-6">
        {/* By Category */}
        <Card className="p-6 bg-muted/20 border-white/5">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                Memories by Category
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(stats.byCategory).map(([category, count]) => {
                    const config = CATEGORY_CONFIG[category as MemoryCategory];
                    return (
                        <div key={category} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                            <config.icon className={cn("w-5 h-5", config.color.split(' ')[1])} />
                            <div>
                                <p className="text-sm font-medium">{config.label}</p>
                                <p className="text-2xl font-black">{count}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>

        {/* By Source */}
        <Card className="p-6 bg-muted/20 border-white/5">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Memories by Source
            </h3>
            <div className="space-y-2">
                {Object.entries(stats.bySource).map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between p-2 rounded bg-white/5">
                        <span className="text-sm capitalize">{source.replace(/_/g, ' ')}</span>
                        <span className="font-bold">{count}</span>
                    </div>
                ))}
            </div>
        </Card>

        {/* Health Metrics */}
        <Card className="p-6 bg-muted/20 border-white/5">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                <Gauge className="w-4 h-4 text-primary" />
                Health Metrics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard label="Avg. Confidence" value={`${(stats.averageConfidence * 100).toFixed(1)}%`} />
                <MetricCard label="Avg. Importance" value={`${(stats.averageImportance * 100).toFixed(1)}%`} />
                <MetricCard label="Recently Accessed" value={stats.recentlyAccessed} subtitle="Last 24h" />
                <MetricCard label="Recently Created" value={stats.recentlyCreated} subtitle="Last 24h" />
            </div>
        </Card>
    </div>
);

const MetricCard = ({ label, value, subtitle }: { label: string; value: string | number; subtitle?: string }) => (
    <div className="p-3 rounded-lg bg-white/5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</p>
        <p className="text-xl font-black">{value}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground/50">{subtitle}</p>}
    </div>
);

const EmptyState = ({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) => (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-muted/10 rounded-2xl border border-dashed border-white/5">
        <Icon className="w-12 h-12 text-muted-foreground/20" />
        <div className="space-y-1">
            <h3 className="font-bold text-muted-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground/50 max-w-[200px]">{description}</p>
        </div>
    </div>
);
