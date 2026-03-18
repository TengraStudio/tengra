/**
 * Session History component for viewing all past idea generation sessions
 */
import { IdeaCategory, IdeaSession, IdeaStatus, WorkspaceIdea } from '@shared/types/ideas';
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
    onSelectIdea: (idea: WorkspaceIdea) => void
    onSelectSession: (sessionId: string) => void
    onBulkDelete: (ideaIds: string[]) => void
    t: (key: string) => string
}

interface SessionWithIdeas {
    session: IdeaSession
    ideas: WorkspaceIdea[]
    isExpanded: boolean
    isLoading: boolean
}

const formatDate = (timestamp: number, t: (key: string, params?: Record<string, RendererDataValue>) => string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) { return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    if (diffDays === 1) { return t('dateGroups.yesterday'); }
    if (diffDays < 7) { return t('ideas.history.daysAgo', { count: diffDays }); }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
    completed: <CheckCircle className="w-4 h-4 text-success" />,
    cancelled: <XCircle className="w-4 h-4 text-destructive" />,
    generating: <Loader2 className="w-4 h-4 text-primary animate-spin" />,
    researching: <Loader2 className="w-4 h-4 text-primary animate-spin" />,
};

const getStatusIcon = (status: string): React.ReactNode =>
    STATUS_ICONS[status] ?? <Clock className="w-4 h-4 text-muted-foreground/40" />;

const getIdeaStatusBadge = (status: IdeaStatus, t: (key: string) => string) => {
    const config = IDEA_STATUS_BADGES[status];
    return (
        <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs', config.className)}>
            {config.icon}
            {t(config.labelKey)}
        </span>
    );
};

/**
 * Bulk delete controls
 */
interface BulkDeleteControlsProps {
    selectedCount: number
    onClearSelection: () => void
    onDelete: () => void
    t: (key: string, params?: Record<string, RendererDataValue>) => string
}

const BulkDeleteControls: React.FC<BulkDeleteControlsProps> = ({
    selectedCount,
    onClearSelection,
    onDelete,
    t
}) => {
    if (selectedCount === 0) {
        return null;
    }

    return (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <p className="text-sm font-medium text-foreground">
                    {t('ideas.history.ideasSelected', { count: selectedCount })}
                </p>
                <button
                    onClick={onClearSelection}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    {t('ideas.history.clearSelection')}
                </button>
            </div>
            <button
                onClick={onDelete}
                className="px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded-lg flex items-center gap-2 transition-colors text-sm font-medium"
            >
                <Trash2 className="w-4 h-4" />
                {t('ideas.history.deleteSelected')}
            </button>
        </div>
    );
};
BulkDeleteControls.displayName = 'BulkDeleteControls';

/**
 * Search and filter controls
 */
interface SearchAndFilterProps {
    searchQuery: string
    onSearchChange: (value: string) => void
    statusFilter: 'all' | 'pending' | 'approved' | 'rejected'
    onStatusChange: (value: 'all' | 'pending' | 'approved' | 'rejected') => void
    categoryFilter: 'all' | IdeaCategory
    onCategoryChange: (value: 'all' | IdeaCategory) => void
    availableCategories: IdeaCategory[]
    onClearFilters: () => void
    t: (key: string) => string
}

const SearchAndFilterControls: React.FC<SearchAndFilterProps> = ({
    searchQuery,
    onSearchChange,
    statusFilter,
    onStatusChange,
    categoryFilter,
    onCategoryChange,
    availableCategories,
    onClearFilters,
    t
}) => {
    const hasActiveFilters = searchQuery || statusFilter !== 'all' || categoryFilter !== 'all';

    return (
        <div className="bg-muted/30 backdrop-blur-sm rounded-xl border border-border/50 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Input */}
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => { onSearchChange(e.target.value); }}
                        placeholder={t('ideas.search.placeholder')}
                        className="w-full pl-10 pr-4 py-2 bg-background/50 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    />
                </div>

                {/* Status Filter */}
                <select
                    value={statusFilter}
                    onChange={(e) => { onStatusChange(e.target.value as typeof statusFilter); }}
                    className="px-3 py-2 bg-background/50 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                >
                    <option value="all">{t('ideas.filter.allStatuses')}</option>
                    <option value="pending">{t('ideas.filter.pending')}</option>
                    <option value="approved">{t('ideas.filter.approved')}</option>
                    <option value="rejected">{t('ideas.filter.rejected')}</option>
                </select>

                {/* Category Filter */}
                <select
                    value={categoryFilter}
                    onChange={(e) => { onCategoryChange(e.target.value as 'all' | IdeaCategory); }}
                    className="px-3 py-2 bg-background/50 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                >
                    <option value="all">{t('ideas.filter.allCategories')}</option>
                    {availableCategories.map(cat => (
                        <option key={cat} value={cat}>{t(getCategoryMeta(cat).labelKey)}</option>
                    ))}
                </select>
            </div>

            {/* Active Filters Indicator */}
            {hasActiveFilters && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{t('ideas.history.activeFilters')}</span>
                    {searchQuery && (
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                            {t('ideas.history.filter.searchLabel')}: "{searchQuery}"
                        </span>
                    )}
                    {statusFilter !== 'all' && (
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                            {t('ideas.history.filter.statusLabel')}: {t(`ideas.filter.${statusFilter}`)}
                        </span>
                    )}
                    {categoryFilter !== 'all' && (
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                            {t('ideas.history.filter.categoryLabel')}: {t(getCategoryMeta(categoryFilter as IdeaCategory).labelKey)}
                        </span>
                    )}
                    <button
                        onClick={onClearFilters}
                        className="ml-auto px-2 py-1 hover:bg-muted/50 rounded text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {t('ideas.history.clearFilters')}
                    </button>
                </div>
            )}
        </div>
    );
};
SearchAndFilterControls.displayName = 'SearchAndFilterControls';

/**
 * Statistics overview cards
 */
interface StatsOverviewProps {
    stats: SessionStats
    t: (key: string) => string
}

const StatsOverview: React.FC<StatsOverviewProps> = ({ stats, t }) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-muted/30 backdrop-blur-sm rounded-xl border border-border/50 p-4">
            <p className="text-2xl font-bold text-foreground">{stats.totalSessions}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('ideas.history.totalSessions')}</p>
        </div>
        <div className="bg-muted/30 backdrop-blur-sm rounded-xl border border-border/50 p-4">
            <p className="text-2xl font-bold text-primary">{stats.completedSessions}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('ideas.history.completed')}</p>
        </div>
        <div className="bg-muted/30 backdrop-blur-sm rounded-xl border border-border/50 p-4">
            <p className="text-2xl font-bold text-success">{stats.approved}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('ideas.history.approvedIdeas')}</p>
        </div>
        <div className="bg-muted/30 backdrop-blur-sm rounded-xl border border-border/50 p-4">
            <p className="text-2xl font-bold text-warning">{stats.pending}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('ideas.history.pendingReview')}</p>
        </div>
    </div>
);
StatsOverview.displayName = 'StatsOverview';

/**
 * Empty state when no sessions exist
 */
interface EmptyStateProps {
    t: (key: string) => string
}

const EmptyState: React.FC<EmptyStateProps> = ({ t }) => (
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
EmptyState.displayName = 'EmptyState';

/**
 * Sessions grouped display
 */
interface SessionsGroupDisplayProps {
    filteredGroupedSessions: Array<{ label: string; sessions: SessionWithIdeas[] }>
    selectedIdeaIds: Set<string>
    onToggleSession: (sessionId: string) => void | Promise<void>
    onSelectIdea: (idea: WorkspaceIdea) => void
    onSelectSession: (sessionId: string) => void
    onToggleIdeaSelect: (ideaId: string) => void
    t: (key: string, params?: Record<string, RendererDataValue>) => string
}

const SessionsGroupDisplay: React.FC<SessionsGroupDisplayProps> = ({
    filteredGroupedSessions,
    selectedIdeaIds,
    onToggleSession,
    onSelectIdea,
    onSelectSession,
    onToggleIdeaSelect,
    t
}) => (
    <>
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
                            onToggle={(id) => { void onToggleSession(id); }}
                            onSelectIdea={onSelectIdea}
                            onSelectSession={onSelectSession}
                            selectedIdeaIds={selectedIdeaIds}
                            onToggleIdeaSelect={onToggleIdeaSelect}
                            t={t}
                        />
                    ))}
                </div>
            </div>
        ))}
    </>
);
SessionsGroupDisplay.displayName = 'SessionsGroupDisplay';

/**
 * Initializes session map
 */
const createInitialSessionMap = (sessions: IdeaSession[]): Map<string, SessionWithIdeas> => {
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
};

/**
 * Syncs sessions when they change
 */
const syncSessionsWithIdeas = (
    sessions: IdeaSession[],
    sessionsWithIdeas: Map<string, SessionWithIdeas>
): Map<string, SessionWithIdeas> => {
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
    return newMap;
};

interface IdeaStatusBadgeConfig {
    className: string
    icon: React.ReactNode
    labelKey: string
}

const IDEA_STATUS_BADGES: Record<IdeaStatus, IdeaStatusBadgeConfig> = {
    approved: {
        className: 'bg-success/20 text-success',
        icon: <CheckCircle className="w-3 h-3" />,
        labelKey: 'ideas.status.approved'
    },
    rejected: {
        className: 'bg-destructive/20 text-destructive',
        icon: <ThumbsDown className="w-3 h-3" />,
        labelKey: 'ideas.status.rejected'
    },
    pending: {
        className: 'bg-yellow/20 text-warning',
        icon: <Clock className="w-3 h-3" />,
        labelKey: 'ideas.status.pending'
    },
    archived: {
        className: 'bg-muted/50 text-muted-foreground',
        icon: <Clock className="w-3 h-3" />,
        labelKey: 'ideas.status.archived'
    }
};

/**
 * Groups sessions by date for better organization
 */
const groupSessionsByDate = (
    sessions: IdeaSession[],
    sessionsWithIdeas: Map<string, SessionWithIdeas>,
    t: (key: string, params?: Record<string, RendererDataValue>) => string
): Array<{ label: string; sessions: SessionWithIdeas[] }> => {
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
};

/**
 * Computes statistics from all sessions
 */
interface SessionStats {
    totalSessions: number
    completedSessions: number
    totalIdeas: number
    approved: number
    pending: number
}

const computeStats = (
    sessions: IdeaSession[],
    sessionsWithIdeas: Map<string, SessionWithIdeas>
): SessionStats => {
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
};

/**
 * Filters ideas based on search query and status/category filters
 */
const filterIdeasByQuery = (
    idea: WorkspaceIdea,
    searchQuery: string,
    statusFilter: string,
    categoryFilter: string
): boolean => {
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
};

/**
 * Filters grouped sessions based on search and filter criteria
 */
const filterGroupedSessions = (
    groupedSessions: Array<{ label: string; sessions: SessionWithIdeas[] }>,
    searchQuery: string,
    statusFilter: string,
    categoryFilter: string
): Array<{ label: string; sessions: SessionWithIdeas[] }> => {
    const hasActiveFilters = searchQuery || statusFilter !== 'all' || categoryFilter !== 'all';

    if (!hasActiveFilters) {
        return groupedSessions;
    }

    return groupedSessions
        .map(group => ({
            ...group,
            sessions: group.sessions
                .map(sessionData => ({
                    ...sessionData,
                    ideas: sessionData.ideas.filter(idea =>
                        filterIdeasByQuery(idea, searchQuery, statusFilter, categoryFilter)
                    )
                }))
                .filter(sessionData => sessionData.ideas.length > 0 || !hasActiveFilters)
        }))
        .filter(group => group.sessions.length > 0);
};

interface IdeaRowProps {
    idea: WorkspaceIdea
    onSelect: (idea: WorkspaceIdea) => void
    isSelected: boolean
    onToggleSelect: (ideaId: string) => void
    t: (key: string) => string
}

const IdeaRowContent: React.FC<{ idea: WorkspaceIdea; meta: ReturnType<typeof getCategoryMeta>; t: (key: string) => string }> = ({ idea, meta, t }) => {
    const Icon = meta.icon;
    return (
        <div className="flex-1 flex items-center gap-3 text-left">
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
        </div>
    );
};
IdeaRowContent.displayName = 'IdeaRowContent';

const IdeaRow: React.FC<IdeaRowProps> = ({
    idea,
    onSelect,
    isSelected,
    onToggleSelect,
    t
}) => {
    const meta = getCategoryMeta(idea.category);

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
                <IdeaRowContent idea={idea} meta={meta} t={t} />
            </button>
        </div>
    );
};
IdeaRow.displayName = 'IdeaRow';

interface SessionHeaderProps {
    session: IdeaSession
    isExpanded: boolean
    isLoading: boolean
    onToggle: (sessionId: string) => void | Promise<void>
    onSelectSession: (sessionId: string) => void
    t: (key: string, params?: Record<string, RendererDataValue>) => string
}

const SessionHeader: React.FC<SessionHeaderProps> = ({
    session,
    isExpanded,
    onToggle,
    onSelectSession,
    t
}) => {
    return (
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
                            return t(meta.labelKey);
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
                        {t('ideas.history.ideasGenerated', { current: session.ideasGenerated, total: session.maxIdeas })}
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
    );
};
SessionHeader.displayName = 'SessionHeader';

interface IdeasListProps {
    ideas: WorkspaceIdea[]
    isLoading: boolean
    selectedIdeaIds: Set<string>
    onSelectIdea: (idea: WorkspaceIdea) => void
    onToggleIdeaSelect: (ideaId: string) => void
    t: (key: string) => string
}

const IdeasList: React.FC<IdeasListProps> = ({
    ideas,
    isLoading,
    selectedIdeaIds,
    onSelectIdea,
    onToggleIdeaSelect,
    t
}) => {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
            </div>
        );
    }

    if (ideas.length === 0) {
        return (
            <p className="text-center text-sm text-muted-foreground/40 py-4">
                {t('ideas.history.noIdeasYet')}
            </p>
        );
    }

    return (
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
    );
};
IdeasList.displayName = 'IdeasList';

interface SessionRowProps {
    sessionData: SessionWithIdeas
    onToggle: (sessionId: string) => void | Promise<void>
    onSelectIdea: (idea: WorkspaceIdea) => void
    onSelectSession: (sessionId: string) => void
    selectedIdeaIds: Set<string>
    onToggleIdeaSelect: (ideaId: string) => void
    t: (key: string, params?: Record<string, RendererDataValue>) => string
}

const SessionRow: React.FC<SessionRowProps> = ({
    sessionData,
    onToggle,
    onSelectIdea,
    onSelectSession,
    selectedIdeaIds,
    onToggleIdeaSelect,
    t
}) => {
    const { session, ideas, isExpanded, isLoading } = sessionData;

    return (
        <div className="bg-muted/30 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden">
            <SessionHeader
                session={session}
                isExpanded={isExpanded}
                isLoading={isLoading}
                onToggle={onToggle}
                onSelectSession={onSelectSession}
                t={t}
            />

            {/* Ideas List (Expandable) */}
            {isExpanded && (
                <div className="border-t border-border/50 p-2">
                    <IdeasList
                        ideas={ideas}
                        isLoading={isLoading}
                        selectedIdeaIds={selectedIdeaIds}
                        onSelectIdea={onSelectIdea}
                        onToggleIdeaSelect={onToggleIdeaSelect}
                        t={t}
                    />
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
    const [categoryFilter, setCategoryFilter] = useState<'all' | IdeaCategory>('all');

    const initialMap = useMemo(() => createInitialSessionMap(sessions), [sessions]);
    const [sessionsWithIdeas, setSessionsWithIdeas] = useState<Map<string, SessionWithIdeas>>(initialMap);
    const [prevSessions, setPrevSessions] = useState(sessions);

    // Sync state when sessions change
    if (sessions !== prevSessions) {
        setPrevSessions(sessions);
        setSessionsWithIdeas(syncSessionsWithIdeas(sessions, sessionsWithIdeas));
    }

    const toggleSession = useCallback(async (sessionId: string): Promise<void> => {
        setSessionsWithIdeas(prev => {
            const current = prev.get(sessionId);
            if (!current) {
                return prev;
            }

            if (current.isExpanded) {
                const newMap = new Map(prev);
                newMap.set(sessionId, { ...current, isExpanded: false });
                return newMap;
            }

            const newMap = new Map(prev);
            newMap.set(sessionId, { ...current, isExpanded: true, isLoading: true });
            return newMap;
        });

        try {
            const ideas = await window.electron.ideas.getIdeas(sessionId);
            setSessionsWithIdeas(prev => {
                const updated = prev.get(sessionId);
                if (updated) {
                    const newMap = new Map(prev);
                    newMap.set(sessionId, { ...updated, ideas, isLoading: false });
                    return newMap;
                }
                return prev;
            });
        } catch {
            setSessionsWithIdeas(prev => {
                const updated = prev.get(sessionId);
                if (updated) {
                    const newMap = new Map(prev);
                    newMap.set(sessionId, { ...updated, isLoading: false });
                    return newMap;
                }
                return prev;
            });
        }
    }, []);

    const toggleIdeaSelection = useCallback((ideaId: string): void => {
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

    const clearSelection = useCallback((): void => {
        setSelectedIdeaIds(new Set());
    }, []);

    const handleBulkDeleteClick = useCallback((): void => {
        if (selectedIdeaIds.size === 0) {
            return;
        }
        onBulkDelete(Array.from(selectedIdeaIds));
        clearSelection();
    }, [selectedIdeaIds, onBulkDelete, clearSelection]);

    const groupedSessions = React.useMemo(
        () => groupSessionsByDate(sessions, sessionsWithIdeas, t),
        [sessions, sessionsWithIdeas, t]
    );

    const stats = React.useMemo(
        () => computeStats(sessions, sessionsWithIdeas),
        [sessions, sessionsWithIdeas]
    );

    const filteredGroupedSessions = React.useMemo(
        () => filterGroupedSessions(groupedSessions, searchQuery, statusFilter, categoryFilter),
        [groupedSessions, searchQuery, statusFilter, categoryFilter]
    );

    const availableCategories = React.useMemo(() => {
        const categories = new Set<IdeaCategory>();
        for (const data of sessionsWithIdeas.values()) {
            for (const idea of data.ideas) {
                categories.add(idea.category);
            }
        }
        return Array.from(categories).sort();
    }, [sessionsWithIdeas]);

    if (sessions.length === 0) {
        return <EmptyState t={t} />;
    }

    const handleClearFilters = (): void => {
        setSearchQuery('');
        setStatusFilter('all');
        setCategoryFilter('all');
    };

    return (
        <div className="space-y-6">
            <BulkDeleteControls
                selectedCount={selectedIdeaIds.size}
                onClearSelection={clearSelection}
                onDelete={handleBulkDeleteClick}
                t={t}
            />

            <SearchAndFilterControls
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                categoryFilter={categoryFilter}
                onCategoryChange={setCategoryFilter}
                availableCategories={availableCategories}
                onClearFilters={handleClearFilters}
                t={t}
            />

            <StatsOverview stats={stats} t={t} />

            <SessionsGroupDisplay
                filteredGroupedSessions={filteredGroupedSessions}
                selectedIdeaIds={selectedIdeaIds}
                onToggleSession={toggleSession}
                onSelectIdea={onSelectIdea}
                onSelectSession={onSelectSession}
                onToggleIdeaSelect={toggleIdeaSelection}
                t={t}
            />
        </div>
    );
};
