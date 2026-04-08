import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import type { MarketplaceSkill } from '@shared/types/marketplace';
import type { ProxySkill } from '@shared/types/skill';
import {
    ChevronLeft,
    ChevronRight,
    Download,
    RefreshCw,
    Search,
    Sparkles,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n';
import { pushNotification } from '@/store/notification-center.store';

import type { MarketplaceQueryState } from '../marketplace-query.types';

const PAGE_SIZE = 24;

interface SkillsMarketplaceProps {
    skills: ProxySkill[];
    marketplaceSkills: MarketplaceSkill[];
    loading: boolean;
    onRefreshSkills: () => Promise<void>;
    onRefreshRegistry: () => Promise<void>;
    query: MarketplaceQueryState;
    onQueryChange: (updater: (prev: MarketplaceQueryState) => MarketplaceQueryState) => void;
}

export function SkillsMarketplace({
    skills,
    marketplaceSkills,
    loading,
    onRefreshSkills,
    onRefreshRegistry,
    query,
    onQueryChange,
}: SkillsMarketplaceProps): JSX.Element {
    const { t } = useTranslation();
    const { search, filter, sort, page } = query;
    const [installingId, setInstallingId] = useState<string | null>(null);
    const [uninstallingId, setUninstallingId] = useState<string | null>(null);

    const installedSkillIds = useMemo(() => new Set(skills.map(skill => skill.id)), [skills]);
    const filteredSkills = useMemo(() => {
        const term = search.trim().toLowerCase();
        return marketplaceSkills.filter(skill => {
            const matchesText = !term || skill.name.toLowerCase().includes(term) || skill.description.toLowerCase().includes(term);
            if (!matchesText) {
                return false;
            }
            const installed = installedSkillIds.has(skill.id);
            if (filter === 'installed') {
                return installed;
            }
            if (filter === 'not_installed') {
                return !installed;
            }
            return true;
        }).sort((a, b) => {
            if (sort === 'name_asc') {
                return a.name.localeCompare(b.name);
            }
            if (sort === 'name_desc') {
                return b.name.localeCompare(a.name);
            }
            return b.version.localeCompare(a.version);
        });
    }, [filter, installedSkillIds, marketplaceSkills, search, sort]);
    const totalPages = Math.max(1, Math.ceil(filteredSkills.length / PAGE_SIZE));
    const activePage = Math.min(page, totalPages);
    const pagedSkills = filteredSkills.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);

    const handleInstall = useCallback(async (skillId: string) => {
        setInstallingId(skillId);
        try {
            const skillSource = marketplaceSkills.find(s => s.id === skillId);
            if (!skillSource) {
                throw new Error('Skill definition not found in marketplace');
            }

            const result = await window.electron.marketplace.install({
                type: 'skill',
                id: skillSource.id,
                name: skillSource.name,
                description: skillSource.description,
                author: skillSource.author,
                version: skillSource.version,
                downloadUrl: skillSource.downloadUrl
            });
            if (result.success) {
                await Promise.all([onRefreshRegistry(), onRefreshSkills()]);
                pushNotification({
                    type: 'success',
                    message: t('marketplace.installSuccess', { name: skillSource.name }),
                });
            } else {
                pushNotification({
                    type: 'error',
                    message: result.message || t('marketplace.installFailure'),
                });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : t('marketplace.installFailure');
            pushNotification({
                type: 'error',
                message,
            });
        } finally {
            setInstallingId(null);
        }
    }, [marketplaceSkills, onRefreshRegistry, onRefreshSkills, t]);

    const handleUninstall = useCallback(async (skillId: string) => {
        setUninstallingId(skillId);
        try {
            await window.electron.deleteSkill(skillId);
            await onRefreshSkills();
            pushNotification({
                type: 'success',
                message: t('common.deleted'),
            });
        } catch {
            pushNotification({
                type: 'error',
                message: t('common.deleteFailed'),
            });
        } finally {
            setUninstallingId(null);
        }
    }, [onRefreshSkills, t]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 space-y-5">
                <RefreshCw className="w-8 h-8 text-primary animate-spin opacity-40" />
                <p className="text-xs font-bold text-muted-foreground animate-pulse">
                    {t('marketplace.syncing')}
                </p>
            </div>
        );
    }

    if (marketplaceSkills.length === 0) {
        return (
            <div className="col-span-full py-20 text-center border border-dashed border-border/40 rounded-xl bg-muted/5">
                <Sparkles className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground font-bold">
                    {t('settings.skills.marketplaceEmpty')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-muted/10 p-3 md:flex-row md:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                    <input
                        type="text"
                        value={search}
                        placeholder={t('marketplace.search')}
                        onChange={event => {
                            onQueryChange(prev => ({ ...prev, search: event.target.value, page: 1 }));
                        }}
                        className="w-full rounded border border-border/30 bg-background py-2 pl-10 pr-3 text-sm font-medium outline-none transition-colors focus:border-primary/40"
                    />
                </div>
                <Select
                    value={filter}
                    onValueChange={value => {
                        onQueryChange(prev => ({
                            ...prev,
                            filter: value as MarketplaceQueryState['filter'],
                            page: 1,
                        }));
                    }}
                >
                    <SelectTrigger className="h-9 w-40 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{t('marketplace.mcp.filters.all')}</SelectItem>
                        <SelectItem value="installed">{t('modelExplorer.installed')}</SelectItem>
                        <SelectItem value="not_installed">{t('marketplace.install')}</SelectItem>
                    </SelectContent>
                </Select>
                <Select
                    value={sort}
                    onValueChange={value => {
                        onQueryChange(prev => ({
                            ...prev,
                            sort: value as MarketplaceQueryState['sort'],
                            page: 1,
                        }));
                    }}
                >
                    <SelectTrigger className="h-9 w-40 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="name_asc">{t('modelExplorer.name')} ↑</SelectItem>
                        <SelectItem value="name_desc">{t('modelExplorer.name')} ↓</SelectItem>
                        <SelectItem value="version_desc">{t('mcp.version')} ↓</SelectItem>
                    </SelectContent>
                </Select>
                <div className="rounded-full bg-muted/30 px-3 py-1 text-xs font-bold text-muted-foreground">
                    {filteredSkills.length} {t('marketplace.results')}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {pagedSkills.map(item => {
                    const installed = installedSkillIds.has(item.id);
                    const isInstalling = installingId === item.id;
                    const isUninstalling = uninstallingId === item.id;
                    return (
                        <div
                            key={item.id}
                            className="group flex flex-col bg-card border border-border/40 rounded-lg p-5 hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-md"
                        >
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded bg-muted/40 text-muted-foreground group-hover:text-primary transition-colors">
                                        <Sparkles className="w-4.5 h-4.5" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-foreground leading-none mb-1">{item.name}</h3>
                                        <p className="text-xs text-muted-foreground font-medium">{item.description}</p>
                                    </div>
                                </div>
                                <Badge variant="outline" className="typo-body uppercase">
                                    {item.provider}
                                </Badge>
                            </div>
                            <div className="mt-auto flex items-center justify-between gap-3">
                                <span className="typo-body text-muted-foreground font-semibold">
                                    v{item.version}
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant={installed ? 'secondary' : 'outline'}
                                        disabled={installed || isInstalling || isUninstalling}
                                        onClick={() => {
                                            void handleInstall(item.id);
                                        }}
                                    >
                                        {isInstalling ? (
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Download className="h-4 w-4" />
                                        )}
                                        {installed
                                            ? t('modelExplorer.installed')
                                            : t('marketplace.install')}
                                    </Button>
                                    {installed ? (
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            disabled={isUninstalling || isInstalling}
                                            onClick={() => {
                                                void handleUninstall(item.id);
                                            }}
                                        >
                                            {isUninstalling ? (
                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                            ) : null}
                                            {t('common.remove')}
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            {filteredSkills.length > PAGE_SIZE ? (
                <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                        type="button"
                        onClick={() => onQueryChange(prev => ({ ...prev, page: Math.max(1, activePage - 1) }))}
                        disabled={activePage <= 1}
                        className="inline-flex items-center gap-1 rounded-md border border-border/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        {t('common.previous')}
                    </button>
                    <span className="text-xs font-semibold text-muted-foreground">
                        {t('common.pageOf', { current: activePage, total: totalPages })}
                    </span>
                    <button
                        type="button"
                        onClick={() => onQueryChange(prev => ({ ...prev, page: Math.min(totalPages, activePage + 1) }))}
                        disabled={activePage >= totalPages}
                        className="inline-flex items-center gap-1 rounded-md border border-border/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {t('common.next')}
                        <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            ) : null}
        </div>
    );
}

