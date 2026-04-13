import type { MarketplaceSkill } from '@shared/types/marketplace';
import type { ProxySkill } from '@shared/types/skill';
import {
    ChevronLeft,
    ChevronRight,
    Download,
    RefreshCw,
    Search,
    Sparkles,
    Trash2,
    CheckCircle2,
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
    onRefreshRegistry: (force?: boolean) => Promise<void>;
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
                await Promise.all([onRefreshRegistry(true), onRefreshSkills()]);
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
                <p className="typo-caption font-bold text-muted-foreground animate-pulse">
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
            <div className="flex flex-col gap-4 px-1 md:flex-row md:items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                    <div className="relative flex-1 max-w-lg">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/30" />
                        <input
                            type="text"
                            value={search}
                            placeholder={t('marketplace.search')}
                            onChange={event => {
                                onQueryChange(prev => ({ ...prev, search: event.target.value, page: 1 }));
                            }}
                            className="w-full bg-muted/40 rounded-lg px-12 py-2.5 text-sm focus:outline-none transition-all font-medium placeholder:text-muted-foreground/30"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-3">
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
                        <SelectTrigger className="h-10 w-40 text-[10px] font-black bg-muted/20 border-none rounded-lg uppercase tracking-widest text-muted-foreground/60">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-none shadow-2xl">
                            <SelectItem value="all">{t('marketplace.mcp.filters.all')}</SelectItem>
                            <SelectItem value="installed">{t('modelExplorer.installed')}</SelectItem>
                            <SelectItem value="not_installed">{t('marketplace.install')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="divide-y divide-muted/10 border-t border-muted/10">
                {pagedSkills.map(item => {
                    const installed = installedSkillIds.has(item.id);
                    const isInstalling = installingId === item.id;
                    const isUninstalling = uninstallingId === item.id;
                    return (
                        <div
                            key={item.id}
                            className={`
                                group relative flex items-start gap-4 p-4 transition-colors duration-200
                                ${installed ? 'bg-primary/[0.03]' : 'bg-transparent hover:bg-muted/30'}
                            `}
                        >
                            {/* Icon */}
                            <div className={`
                                flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-transform
                                ${installed 
                                    ? 'bg-primary/10 text-primary' 
                                    : 'bg-muted/50 text-muted-foreground group-hover:scale-105'}
                            `}>
                                <Sparkles className="w-6 h-6" />
                            </div>

                            <div className="flex flex-1 flex-col min-w-0 py-0.5">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <h3 className="truncate text-base font-semibold text-foreground/90">
                                            {item.name}
                                        </h3>
                                        {installed && (
                                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success opacity-80" />
                                        )}
                                    </div>
                                    
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            disabled={installed || isInstalling || isUninstalling}
                                            onClick={() => {
                                                void handleInstall(item.id);
                                            }}
                                            className={`
                                                h-8 px-4 flex items-center gap-2 rounded-md transition-all active:scale-95 text-[10px] font-bold uppercase tracking-wider
                                                ${installed 
                                                    ? 'bg-success/10 text-success' 
                                                    : isInstalling 
                                                        ? 'bg-muted text-muted-foreground animate-pulse' 
                                                        : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'}
                                            `}
                                        >
                                            {isInstalling ? (
                                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Download className={`h-3.5 w-3.5 ${installed ? 'hidden' : ''}`} />
                                            )}
                                            {installed
                                                ? t('modelExplorer.installed')
                                                : t('marketplace.install')}
                                        </button>
                                        {installed && (
                                            <button
                                                disabled={isUninstalling || isInstalling}
                                                onClick={() => {
                                                    void handleUninstall(item.id);
                                                }}
                                                className="h-8 px-2 flex items-center gap-1.5 rounded-md text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all active:scale-95 text-[10px] font-bold uppercase tracking-wider"
                                            >
                                                {isUninstalling ? (
                                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                )}
                                                {t('common.remove')}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-1 flex items-center gap-2 text-[11px] font-medium text-muted-foreground/60">
                                    <span className="truncate">{item.provider}</span>
                                    <span className="opacity-30">•</span>
                                    <span className="font-bold">v{item.version}</span>
                                </div>

                                <p className="mt-2 line-clamp-1 text-sm text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors">
                                    {item.description}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredSkills.length > PAGE_SIZE ? (
                <div className="flex items-center justify-center gap-6 pt-6">
                    <button
                        type="button"
                        onClick={() => onQueryChange(prev => ({ ...prev, page: Math.max(1, activePage - 1) }))}
                        disabled={activePage <= 1}
                        className="p-2 rounded-full hover:bg-muted text-muted-foreground/40 hover:text-foreground transition-all active:scale-90"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">
                        {t('common.pageOf', { current: activePage, total: totalPages })}
                    </span>
                    <button
                        type="button"
                        onClick={() => onQueryChange(prev => ({ ...prev, page: Math.min(totalPages, activePage + 1) }))}
                        disabled={activePage >= totalPages}
                        className="p-2 rounded-full hover:bg-muted text-muted-foreground/40 hover:text-foreground transition-all active:scale-90"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            ) : null}
        </div>
    );
}
