import { EntityKnowledge, EpisodicMemory, SemanticFragment } from '@shared/types/memory';
import { formatDistanceToNow } from 'date-fns';
import { LucideIcon } from 'lucide-react';
import {
AlertTriangle,
    Brain, Clock, Database, History, Info,     Plus, RefreshCw,
Search, Tag, Trash2, User} from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/LoadingState';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTranslation } from '@renderer/i18n';

import { useMemory } from '../hooks/useMemory';

type TabType = 'facts' | 'episodes' | 'entities';

export const MemoryInspector: React.FC = () => {
    const { t } = useTranslation();
    const {
        facts, episodes, entities, isLoading, error,
        refresh, deleteFact, deleteEntity, addFact, search
    } = useMemory();

    const [activeTab, setActiveTab] = useState<TabType>('facts');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddFact, setShowAddFact] = useState(false);
    const [newFactContent, setNewFactContent] = useState('');

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        void search(searchQuery);
    };

    const handleAddFact = async () => {
        if (!newFactContent.trim()) {return;}
        await addFact(newFactContent);
        setNewFactContent('');
        setShowAddFact(false);
    };

    if (isLoading && facts.length === 0 && episodes.length === 0 && entities.length === 0) {
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
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                        Memory Inspector
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Visualize and manage what Orbit knows and remembers.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
                        <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                        Refresh
                    </Button>
                    <Button onClick={() => setShowAddFact(true)} size="sm" className="gap-2">
                        <Plus className="w-4 h-4" />
                        Add Fact
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

            {/* Stats & Search */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4 bg-muted/30 border-white/5 flex flex-col gap-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{t('memory.totalFacts')}</p>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-black">{facts.length}</span>
                        <Brain className="w-4 h-4 mb-1 text-primary/50" />
                    </div>
                </Card>
                <Card className="p-4 bg-muted/30 border-white/5 flex flex-col gap-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{t('memory.episodes')}</p>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-black">{episodes.length}</span>
                        <History className="w-4 h-4 mb-1 text-emerald-500/50" />
                    </div>
                </Card>
                <Card className="p-4 bg-muted/30 border-white/5 flex flex-col gap-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{t('memory.entities')}</p>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-black">{entities.length}</span>
                        <User className="w-4 h-4 mb-1 text-purple-500/50" />
                    </div>
                </Card>

                <form onSubmit={handleSearch} className="flex gap-2 items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                        <Input
                            placeholder={t('memory.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-muted/30 border-white/5"
                        />
                    </div>
                    <Button type="submit" variant="secondary">{t('common.search')}</Button>
                </form>
            </div>

            {/* Content Tabs */}
            <div className="flex-1 flex flex-col gap-4 min-h-0">
                <div className="flex gap-1 p-1 bg-muted/30 rounded-lg w-fit border border-white/5">
                    {[
                        { id: 'facts' as TabType, label: 'Facts', icon: Brain },
                        { id: 'episodes' as TabType, label: 'Episodes', icon: History },
                        { id: 'entities' as TabType, label: 'Entities', icon: User },
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
                        </button>
                    ))}
                </div>

                <div className="flex-1 min-h-0">
                    <ScrollArea className="h-full">
                        <div className="grid grid-cols-1 gap-4 pb-6">
                            {activeTab === 'facts' && (
                                <>
                                    {facts.length === 0 ? (
                                        <EmptyState icon={Brain} title={t('memory.noFactsFound')} description={t('memory.factsDescription')} />
                                    ) : (
                                        facts.map(fact => (
                                            <FactCard key={fact.id} fact={fact} onDelete={() => deleteFact(fact.id)} />
                                        ))
                                    )}
                                </>
                            )}

                            {activeTab === 'episodes' && (
                                <>
                                    {episodes.length === 0 ? (
                                        <EmptyState icon={History} title={t('memory.noEpisodesRecorded')} description={t('memory.episodesDescription')} />
                                    ) : (
                                        episodes.map(episode => (
                                            <EpisodeCard key={episode.id} episode={episode} />
                                        ))
                                    )}
                                </>
                            )}

                            {activeTab === 'entities' && (
                                <>
                                    {entities.length === 0 ? (
                                        <EmptyState icon={User} title={t('memory.noEntitiesDetected')} description={t('memory.entitiesDescription')} />
                                    ) : (
                                        entities.map(entity => (
                                            <EntityCard key={entity.id} entity={entity} onDelete={() => deleteEntity(entity.id)} />
                                        ))
                                    )}
                                </>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>

            {/* Add Fact Modal (Simplistic) */}
            {showAddFact && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-md p-6 bg-popover/90 backdrop-blur-2xl border-white/10 shadow-2xl space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Plus className="w-5 h-5 text-primary" />
                            Add Manual Fact
                        </h2>
                        <textarea
                            value={newFactContent}
                            onChange={(e) => setNewFactContent(e.target.value)}
                            className="w-full h-32 bg-muted/50 border border-white/5 rounded-lg p-3 text-sm focus:border-primary/50 outline-none resize-none transition-colors"
                            placeholder={t('memory.factPlaceholder')}
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setShowAddFact(false)}>{t('common.cancel')}</Button>
                            <Button onClick={handleAddFact} disabled={!newFactContent.trim()}>{t('memory.addMemory')}</Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

const FactCard = ({ fact, onDelete }: { fact: SemanticFragment, onDelete: () => void }) => (
    <Card className="group p-4 bg-muted/20 border-white/5 hover:bg-muted/30 transition-all hover:border-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
                onClick={onDelete}
                className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
        <div className="flex flex-col gap-2 pr-10">
            <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] uppercase font-bold">Fact</Badge>
                <span className="text-[10px] text-muted-foreground font-mono">{fact.id}</span>
            </div>
            <p className="text-sm leading-relaxed">{fact.content}</p>
            <div className="flex flex-wrap gap-2 mt-2">
                {fact.tags.map((tag: string) => (
                    <span key={tag} className="flex items-center gap-1 text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-muted-foreground">
                        <Tag className="w-3 h-3" />
                        {tag}
                    </span>
                ))}
            </div>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground/50 italic">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(fact.createdAt))} ago via {fact.source}
            </div>
        </div>
    </Card>
);

const EpisodeCard = ({ episode }: { episode: EpisodicMemory }) => (
    <Card className="p-4 bg-muted/20 border-white/5 hover:border-emerald-500/30 transition-all">
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-none text-[10px] uppercase font-bold">Episode</Badge>
                    <span className="text-sm font-bold">{episode.title}</span>
                </div>
                <div className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(episode.createdAt).toLocaleDateString()}
                </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed italic border-l-2 border-emerald-500/20 pl-3">
                {episode.summary}
            </p>
            <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    Chat ID: {episode.chatId}
                </span>
            </div>
        </div>
    </Card>
);

const EntityCard = ({ entity, onDelete }: { entity: EntityKnowledge, onDelete: () => void }) => (
    <Card className="group p-4 bg-muted/20 border-white/5 hover:border-purple-500/30 transition-all relative">
        <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
                onClick={onDelete}
                className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
        <div className="flex flex-col gap-2 pr-10">
            <div className="flex items-center gap-2">
                <Badge className="bg-purple-500/10 text-purple-400 border-none text-[10px] uppercase font-bold">{entity.entityType}</Badge>
                <span className="text-sm font-bold">{entity.entityName}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-2 items-start mt-1">
                <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">{entity.key}</span>
                <span className="text-xs font-medium text-foreground/90">{entity.value}</span>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50 italic">
                    <Info className="w-3 h-3" />
                    Confidence: {(entity.confidence * 100).toFixed(0)}% • {entity.source}
                </div>
                <span className="text-[10px] text-muted-foreground/30">{formatDistanceToNow(new Date(entity.updatedAt))} ago</span>
            </div>
        </div>
    </Card>
);

const EmptyState = ({ icon: Icon, title, description }: { icon: LucideIcon, title: string, description: string }) => (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-muted/10 rounded-2xl border border-dashed border-white/5">
        <Icon className="w-12 h-12 text-muted-foreground/20" />
        <div className="space-y-1">
            <h3 className="font-bold text-muted-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground/50 max-w-[200px]">{description}</p>
        </div>
    </div>
);
