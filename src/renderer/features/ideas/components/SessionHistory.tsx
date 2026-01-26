/**
 * Session History component for viewing all past idea generation sessions
 */
import { IdeaSession, IdeaStatus, ProjectIdea } from '@shared/types/ideas';
import {
    Calendar,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    Clock,
    Lightbulb,
    Loader2,
    Search,
    ThumbsDown,
    Trash2,
    XCircle
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

import { getCategoryMeta } from '../utils/categories';

interface SessionHistoryProps {
    sessions: IdeaSession[]
    onSelectIdea: (idea: ProjectIdea) => void
    onSelectSession: (sessionId: string) => void
    onBulkDelete: (ideaIds: string[]) => void
    t: (key: string) => string
}

interface SessionWithIdeas {
    session: IdeaSession
    ideas: ProjectIdea[]
    isExpanded: boolean
    isLoading: boolean
}

const formatDate = (timestamp: number, t: (key: string, params?: Record<string, unknown>) => string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) {
        return t('dateGroups.yesterday');
    }
    if (diffDays < 7) {
        return t('ideas.history.daysAgo', { count: diffDays });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const getStatusIcon = (status: string) => {
    switch (status) {
        case 'completed':
            return <CheckCircle className="w-4 h-4 text-green-400" />;
        case 'cancelled':
            return <XCircle className="w-4 h-4 text-red-400" />;
        case 'generating':
        case 'researching':
            return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
        default:
            return <Clock className="w-4 h-4 text-muted-foreground/40" />;
    }
};

const getIdeaStatusBadge = (status: IdeaStatus, t: (key: string) => string) => {
    switch (status) {
        case 'approved':
            return (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    {t('ideas.status.approved')}
                </span>
            );
        case 'rejected':
            return (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
                    <ThumbsDown className="w-3 h-3" />
                    {t('ideas.status.rejected')}
                </span>
            );
        default:
            return (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400">
                    <Clock className="w-3 h-3" />
                    {t('ideas.status.pending')}
                </span>
            );
    }
};

const IdeaRow: React.FC<{ 
    idea: ProjectIdea; 
    onSelect: (idea: ProjectIdea) => void; 
    isSelected: boolean;
    onToggleSelect: (ideaId: string) => void;
    t: (key: string) => string 
}> = ({
    idea,
    onSelect,
    isSelected,
    onToggleSelect,
    t
}) => {
    const meta = getCategoryMeta(idea.category);
    const Icon = meta.icon;

    return (
        <div className="w-full flex items-center gap-3 p-3 hover:bg-muted/20 rounded-lg transition-colors group">
            <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                    e.stopPropagation();
                    onToggleSelect(idea.id);
                }}
                className="w-4 h-4 rounded border-border/50 text-primary focus:ring-primary/20 cursor-pointer"
            />
            <button
                type="button"
                onClick={() => onSelect(idea)}
                className="flex-1 flex items-center gap-3 text-left"
            >
                <div
                    className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                        meta.bgColor,
                        meta.color
                    )}
                >
                    <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {idea.title}
                    </p>
                    <p className="text-xs text-muted-foreground/40 truncate">{idea.description}</p>
                </div>
                {getIdeaStatusBadge(idea.status, t)}
            </button>
        </div>
    );
};
IdeaRow.displayName = 'IdeaRow';

const SessionRow: React.FC<{
    sessionData: SessionWithIdeas
    onToggle: (sessionId: string) => void | Promise<void>
    onSelectIdea: (idea: ProjectIdea) => void
    onSelectSession: (sessionId: string) => void
    selectedIdeaIds: Set<string>
    onToggleIdeaSelect: (ideaId: string) => void
    t: (key: string, params?: Record<string, unknown>) => string
}> = ({ sessionData, onToggle, onSelectIdea, onSelectSession, selectedIdeaIds, onToggleIdeaSelect, t }) => {
    const { session, ideas, isExpanded, isLoading } = sessionData;

    return (
        <div className="bg-muted/30 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden">
            {/* Session Header */}
            <button
                type="button"
                onClick={() => { void onToggle(session.id); }}
                className="w-full flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors"
            >
                <div className="shrink-0">
                    {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground/60" />
                    ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground/60" />
                    )}
                </div>

                <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                        {getStatusIcon(session.status)}
                        <span className="text-sm font-medium text-foreground">
                            {session.categories.map(c => {
                                const meta = getCategoryMeta(c);
                                return meta.label;
                            }).join(', ')}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground/40">
                        <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(session.createdAt, t)}
                        </span>
                        <span className="flex items-center gap-1">
                            <Lightbulb className="w-3 h-3" />
                            {session.ideasGenerated} / {session.maxIdeas} {t('ideas.idea.viewDetails').split(' ')[0].toLowerCase()}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground/60">
                            {session.model}
                        </span>
                    </div>
                </div>

                {session.status === 'completed' && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            void onSelectSession(session.id);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all"
                    >
                        {t('ideas.history.viewDetails')}
                    </button>
                )}
            </button>

            {/* Ideas List (Expandable) */}
            {isExpanded && (
                <div className="border-t border-border/50 p-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
                        </div>
                    ) : ideas.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground/40 py-4">
                            {t('ideas.history.noIdeasYet')}
                        </p>
                    ) : (
                        <div className="space-y-1">
                            {ideas.map(idea => (
                                <IdeaRow
                                    key={idea.id}
                                    idea={idea}
                                    onSelect={onSelectIdea}
                                    isSelected={selectedIdeaIds.has(idea.id)}
                                    onToggleSelect={onToggleIdeaSelect}
                                    t={t}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
SessionRow.displayName = 'SessionRow';

export const SessionHistory: React.FC<SessionHistoryProps> = ({
    sessions,
    onSelectIdea,
    onSelectSession,
    onBulkDelete,
    t
}) => {
    // Selection state for bulk delete
    const [selectedIdeaIds, setSelectedIdeaIds] = useState<Set<string>>(new Set());
    
    // Search and filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    
    // Initialize session map using useMemo to avoid useEffect setState pattern
    const initialMap = useMemo(() => {
        const map = new Map<string, SessionWithIdeas>();
        for (const session of sessions) {
            map.set(session.id, {
                session,
                ideas: [],
                isExpanded: false,
                isLoading: false
            });
        }
        return map;
    }, [sessions]);

    const [sessionsWithIdeas, setSessionsWithIdeas] = useState<Map<string, SessionWithIdeas>>(initialMap);
    const [prevSessions, setPrevSessions] = useState(sessions);

    // Sync state when sessions change (Adjustment during render pattern)
    if (sessions !== prevSessions) {
        setPrevSessions(sessions);
        const newMap = new Map<string, SessionWithIdeas>();
        for (const session of sessions) {
            const existing = sessionsWithIdeas.get(session.id);
            newMap.set(session.id, {
                session,
                ideas: existing?.ideas ?? [],
                isExpanded: existing?.isExpanded ?? false,
                isLoading: existing?.isLoading ?? false
            });
        }
        setSessionsWithIdeas(newMap);
    }

    const toggleSession = useCallback(async (sessionId: string) => {
        // Use functional updates to avoid stale closure
        setSessionsWithIdeas(prev => {
            const current = prev.get(sessionId);
            if (!current) { return prev; }

            // If already expanded, just collapse
            if (current.isExpanded) {
                const newMap = new Map(prev);
                newMap.set(sessionId, { ...current, isExpanded: false });
                return newMap;
            }

            // Expand and set loading
            const newMap = new Map(prev);
            newMap.set(sessionId, { ...current, isExpanded: true, isLoading: true });
            return newMap;
        });

        // Load ideas asynchronously
        try {
            const ideas = await window.electron.ideas.getIdeas(sessionId);
            setSessionsWithIdeas(prev => {
                const newMap = new Map(prev);
                const updated = prev.get(sessionId);
                if (updated) {
                    newMap.set(sessionId, { ...updated, ideas, isLoading: false });
                }
                return newMap;
            });
        } catch {
            setSessionsWithIdeas(prev => {
                const newMap = new Map(prev);
                const updated = prev.get(sessionId);
                if (updated) {
                    newMap.set(sessionId, { ...updated, isLoading: false });
                }
                return newMap;
            });
        }
    }, []);

    // Selection handlers
    const toggleIdeaSelection = useCallback((ideaId: string) => {
        setSelectedIdeaIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(ideaId)) {
                newSet.delete(ideaId);
            } else {
                newSet.add(ideaId);
            }
            return newSet;
        });
    }, []);

    const selectAllInSession = useCallback((sessionId: string) => {
        const session = sessionsWithIdeas.get(sessionId);
        if (!session?.ideas.length) { return; }
        
        setSelectedIdeaIds(prev => {
            const newSet = new Set(prev);
            session.ideas.forEach(idea => newSet.add(idea.id));
            return newSet;
        });
    }, [sessionsWithIdeas]);

    const clearSelection = useCallback(() => {
        setSelectedIdeaIds(new Set());
    }, []);

    const handleBulkDeleteClick = useCallback(() => {
        if (selectedIdeaIds.size === 0) { return; }
        onBulkDelete(Array.from(selectedIdeaIds));
        clearSelection();
    }, [selectedIdeaIds, onBulkDelete, clearSelection]);

    // Group sessions by date
    const groupedSessions = React.useMemo(() => {
        const groups: { label: string; sessions: SessionWithIdeas[] }[] = [];
        const today: SessionWithIdeas[] = [];
        const yesterday: SessionWithIdeas[] = [];
        const thisWeek: SessionWithIdeas[] = [];
        const older: SessionWithIdeas[] = [];

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
        const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;

        for (const session of sessions) {
            const data = sessionsWithIdeas.get(session.id);
            if (!data) { continue; }

            if (session.createdAt >= todayStart) {
                today.push(data);
            } else if (session.createdAt >= yesterdayStart) {
                yesterday.push(data);
            } else if (session.createdAt >= weekStart) {
                thisWeek.push(data);
            } else {
                older.push(data);
            }
        }

        if (today.length > 0) { groups.push({ label: t('dateGroups.today'), sessions: today }); }
        if (yesterday.length > 0) { groups.push({ label: t('dateGroups.yesterday'), sessions: yesterday }); }
        if (thisWeek.length > 0) { groups.push({ label: t('dateGroups.lastWeek'), sessions: thisWeek }); }
        if (older.length > 0) { groups.push({ label: t('dateGroups.older'), sessions: older }); }

        return groups;
    }, [sessions, sessionsWithIdeas, t]);

    // Compute stats
    const stats = React.useMemo(() => {
        let totalIdeas = 0;
        let approved = 0;
        let pending = 0;

        for (const data of sessionsWithIdeas.values()) {
            for (const idea of data.ideas) {
                totalIdeas++;
                if (idea.status === 'approved') { approved++; }
                if (idea.status === 'pending') { pending++; }
            }
        }

        return {
            totalSessions: sessions.length,
            completedSessions: sessions.filter(s => s.status === 'completed').length,
            totalIdeas,
            approved,
            pending
        };
    }, [sessions, sessionsWithIdeas]);

    // Apply filters to sessions and ideas
    const filteredGroupedSessions = React.useMemo(() => {
        if (!searchQuery && statusFilter === 'all' && categoryFilter === 'all') {
            return groupedSessions;
        }

        return groupedSessions.map(group => ({
            ...group,
            sessions: group.sessions.map(sessionData => {
                // Filter ideas within the session
                const filteredIdeas = sessionData.ideas.filter(idea => {
                    // Status filter
                    if (statusFilter !== 'all' && idea.status !== statusFilter) {
                        return false;
                    }
                    
                    // Category filter
                    if (categoryFilter !== 'all' && idea.category !== categoryFilter) {
                        return false;
                    }
                    
                    // Search query
                    if (searchQuery) {
                        const query = searchQuery.toLowerCase();
                        const matchesTitle = idea.title.toLowerCase().includes(query);
                        const matchesDescription = idea.description.toLowerCase().includes(query);
                        return matchesTitle || matchesDescription;
                    }
                    
                    return true;
                });

                return { ...sessionData, ideas: filteredIdeas };
            }).filter(sessionData => {
                // Keep session if it has matching ideas or if we're not filtering
                return sessionData.ideas.length > 0 || (!searchQuery && statusFilter === 'all' && categoryFilter === 'all');
            })
        })).filter(group => group.sessions.length > 0);
    }, [groupedSessions, searchQuery, statusFilter, categoryFilter]);

    // Get unique categories for filter dropdown
    const availableCategories = React.useMemo(() => {
        const categories = new Set<string>();
        for (const data of sessionsWithIdeas.values()) {
            for (const idea of data.ideas) {
                categories.add(idea.category);
            }
        }
        return Array.from(categories).sort();
    }, [sessionsWithIdeas]);

    if (sessions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-4 border border-primary/20">
                    <Lightbulb className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                    {t('ideas.empty.noSessions')}
                </h3>
                <p className="text-muted-foreground max-w-sm">
                    {t('ideas.empty.noSessionsDesc')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Bulk Delete Controls */}
            {selectedIdeaIds.size > 0 && (
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <p className="text-sm font-medium text-foreground">
                            {selectedIdeaIds.size} idea{selectedIdeaIds.size !== 1 ? 's' : ''} selected
                        </p>
                        <button
                            onClick={clearSelection}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Clear selection
                        </button>
                    </div>
                    <button
                        onClick={handleBulkDeleteClick}
                        className="px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded-lg flex items-center gap-2 transition-colors text-sm font-medium"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete Selected
                    </button>
                </div>
            )}

            {/* Search and Filter Controls */}
            <div className="bg-muted/30 backdrop-blur-sm rounded-xl border border-border/50 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search Input */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); }}
                            placeholder={t('ideas.search.placeholder') || 'Search ideas...'}
                            className="w-full pl-10 pr-4 py-2 bg-background/50 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        />
                    </div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); }}
                        className="px-3 py-2 bg-background/50 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    >
                        <option value="all">{t('ideas.filter.allStatuses') || 'All Statuses'}</option>
                        <option value="pending">{t('ideas.filter.pending') || 'Pending'}</option>
                        <option value="approved">{t('ideas.filter.approved') || 'Approved'}</option>
                        <option value="rejected">{t('ideas.filter.rejected') || 'Rejected'}</option>
                    </select>

                    {/* Category Filter */}
                    <select
                        value={categoryFilter}
                        onChange={(e) => { setCategoryFilter(e.target.value); }}
                        className="px-3 py-2 bg-background/50 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    >
                        <option value="all">{t('ideas.filter.allCategories') || 'All Categories'}</option>
                        {availableCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>

                {/* Active Filters Indicator */}
                {(searchQuery || statusFilter !== 'all' || categoryFilter !== 'all') && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Active filters:</span>
                        {searchQuery && (
                            <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                                Search: "{searchQuery}"
                            </span>
                        )}
                        {statusFilter !== 'all' && (
                            <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                                Status: {statusFilter}
                            </span>
                        )}
                        {categoryFilter !== 'all' && (
                            <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                                Category: {categoryFilter}
                            </span>
                        )}
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setStatusFilter('all');
                                setCategoryFilter('all');
                            }}
                            className="ml-auto px-2 py-1 hover:bg-muted/50 rounded text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Clear all
                        </button>
                    </div>
                )}
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted/30 backdrop-blur-sm rounded-xl border border-border/50 p-4">
                    <p className="text-2xl font-bold text-foreground">{stats.totalSessions}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total Sessions</p>
                </div>
                <div className="bg-muted/30 backdrop-blur-sm rounded-xl border border-border/50 p-4">
                    <p className="text-2xl font-bold text-primary">{stats.completedSessions}</p>
                    <p className="text-xs text-muted-foreground mt-1">Completed</p>
                </div>
                <div className="bg-muted/30 backdrop-blur-sm rounded-xl border border-border/50 p-4">
                    <p className="text-2xl font-bold text-green-500">{stats.approved}</p>
                    <p className="text-xs text-muted-foreground mt-1">Approved Ideas</p>
                </div>
                <div className="bg-muted/30 backdrop-blur-sm rounded-xl border border-border/50 p-4">
                    <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
                    <p className="text-xs text-muted-foreground mt-1">Pending Review</p>
                </div>
            </div>

            {/* Grouped Sessions */}
            {filteredGroupedSessions.map(group => (
                <div key={group.label}>
                    <h3 className="text-sm font-semibold text-muted-foreground/60 mb-3 px-1">
                        {group.label}
                    </h3>
                    <div className="space-y-3">
                        {group.sessions.map(sessionData => (
                            <SessionRow
                                key={sessionData.session.id}
                                sessionData={sessionData}
                                onToggle={(id) => { void toggleSession(id); }}
                                onSelectIdea={onSelectIdea}
                                onSelectSession={onSelectSession}
                                selectedIdeaIds={selectedIdeaIds}
                                onToggleIdeaSelect={toggleIdeaSelection}
                                t={t}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};
