/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { MarketplaceSkill } from '@shared/types/marketplace';
import type { ProxySkill } from '@shared/types/skill';
import { IconChevronLeft, IconChevronRight, IconCircleCheck, IconDownload, IconLayoutGrid, IconList, IconRefresh, IconSearch, IconSparkles, IconTrash } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { pushNotification } from '@/store/notification-center.store';

import type { MarketplaceQueryState } from '../marketplace-query.types';

type UnsafeValue = ReturnType<typeof JSON.parse>;

/* Batch-02: Extracted Long Classes */
const C_SKILLSMARKETPLACE_1 = "w-full bg-muted/30 rounded-xl px-12 py-3 text-sm focus:outline-none transition-all font-medium border border-transparent focus:border-primary/20 placeholder:text-muted-foreground/20";
const C_SKILLSMARKETPLACE_2 = "h-8 px-3 flex items-center gap-2 rounded-lg text-destructive/40 hover:text-destructive hover:bg-destructive/5 transition-colors text-sm font-semibold";


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
                    message: t('frontend.marketplace.installSuccess', { name: skillSource.name }),
                });
            } else {
                pushNotification({
                    type: 'error',
                    message: result.message || t('frontend.marketplace.installFailure'),
                });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : t('frontend.marketplace.installFailure');
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
            await window.electron.auth.deleteSkill(skillId);
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
                <IconRefresh className="w-8 h-8 text-primary/40 animate-spin" />
                <p className="text-sm font-semibold text-muted-foreground/30 uppercase ">
                    {t('frontend.marketplace.syncing')}
                </p>
            </div>
        );
    }

    if (marketplaceSkills.length === 0) {
        return (
            <div className="col-span-full py-20 text-center border border-dashed border-border/20 rounded-2xl bg-muted/5">
                <IconSparkles className="w-10 h-10 text-muted-foreground/10 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground/40 font-semibold ">
                    {t('frontend.settings.skills.marketplaceEmpty')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-1">
                <div className="flex items-center gap-4 flex-1 w-full max-w-2xl">
                    <div className="relative flex-1">
                        <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/20" />
                        <input
                            type="text"
                            placeholder={t('frontend.marketplace.search')}
                            value={search}
                            onChange={(e) => onQueryChange(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                            className={C_SKILLSMARKETPLACE_1}
                        />
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-muted/20 rounded-xl shrink-0">
                        <button
                            onClick={() => onQueryChange(prev => ({ ...prev, viewMode: 'list' }))}
                            className={cn(
                                'p-2 rounded-lg transition-all',
                                query.viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/30'
                            )}
                        >
                            <IconList className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onQueryChange(prev => ({ ...prev, viewMode: 'grid' }))}
                            className={cn(
                                'p-2 rounded-lg transition-all',
                                query.viewMode === 'grid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/30'
                            )}
                        >
                            <IconLayoutGrid className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Select
                        value={filter}
                        onValueChange={value => onQueryChange(prev => ({ ...prev, filter: value as UnsafeValue, page: 1 }))}
                    >
                        <SelectTrigger className="h-9 w-40 text-sm font-semibold bg-muted/30 border-none rounded-xl text-muted-foreground/50 hover:bg-muted/40 transition-colors">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-border/10 bg-background/95 backdrop-blur-xl shadow-2xl rounded-xl">
                            <SelectItem value="all">{t('frontend.marketplace.mcp.filters.all')}</SelectItem>
                            <SelectItem value="installed">{t('frontend.modelExplorer.installed')}</SelectItem>
                            <SelectItem value="not_installed">{t('frontend.marketplace.install')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className={cn(
                'transition-all duration-300',
                query.viewMode === 'grid'
                    ? 'grid grid-cols-1 lg:grid-cols-2 gap-4'
                    : 'flex flex-col gap-4'
            )}>
                {pagedSkills.map(item => {
                    const installed = installedSkillIds.has(item.id);
                    const isInstalling = installingId === item.id;
                    const isUninstalling = uninstallingId === item.id;
                    return (
                        <div
                            key={item.id}
                            className={cn(
                                'group relative flex items-start gap-4 p-5 transition-all duration-200 border border-transparent rounded-2xl h-full',
                                installed ? 'bg-primary/[0.02] border-primary/10' : 'bg-transparent hover:bg-muted/30 hover:border-border/30'
                            )}
                        >
                            {/* Icon Container */}
                            <div className={cn(
                                'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all',
                                installed
                                    ? 'bg-primary/10 text-primary shadow-inner'
                                    : 'bg-muted/40 text-muted-foreground/40 group-hover:bg-muted/60 group-hover:text-muted-foreground'
                            )}>
                                <IconSparkles className="w-6 h-6" />
                            </div>

                            <div className="flex flex-1 flex-col min-w-0 py-0.5">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <h3 className="truncate text-base font-semibold text-foreground ">
                                            {item.name}
                                        </h3>
                                        {installed && (
                                            <IconCircleCheck className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            disabled={installed || isInstalling || isUninstalling}
                                            onClick={() => {
                                                void handleInstall(item.id);
                                            }}
                                            className={cn(
                                                'h-8 px-4 flex items-center gap-2 rounded-lg transition-all text-sm font-semibold',
                                                installed
                                                    ? 'bg-primary/5 text-primary'
                                                    : isInstalling
                                                        ? 'bg-muted/60 text-muted-foreground/40 animate-pulse'
                                                        : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                                            )}
                                        >
                                            {isInstalling ? (
                                                <IconRefresh className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <IconDownload className={cn('h-3.5 w-3.5', installed && 'hidden')} />
                                            )}
                                            {installed
                                                ? t('frontend.modelExplorer.installed')
                                                : isInstalling ? t('frontend.marketplace.installing') : t('frontend.marketplace.install')}
                                        </button>
                                        {installed && (
                                            <button
                                                disabled={isUninstalling || isInstalling}
                                                onClick={() => {
                                                    void handleUninstall(item.id);
                                                }}
                                                className={C_SKILLSMARKETPLACE_2}
                                            >
                                                {isUninstalling ? (
                                                    <IconRefresh className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <IconTrash className="h-3.5 w-3.5" />
                                                )}
                                                {t('common.remove')}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-1.5 flex items-center gap-2 text-sm font-medium text-muted-foreground/40">
                                    <span className="truncate">{item.provider}</span>
                                    <span className="opacity-20">•</span>
                                    <span className=" uppercase opacity-80 text-sm">skill</span>
                                </div>

                                <p className="mt-3 line-clamp-1 text-sm text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors">
                                    {item.description}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredSkills.length > PAGE_SIZE ? (
                <div className="flex items-center justify-center gap-8 pt-8">
                    <button
                        type="button"
                        onClick={() => onQueryChange(prev => ({ ...prev, page: Math.max(1, activePage - 1) }))}
                        disabled={activePage <= 1}
                        className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground/20 hover:text-foreground transition-all disabled:opacity-0"
                    >
                        <IconChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="text-sm font-bold uppercase  text-muted-foreground/20">
                        {t('common.pageOf', { current: activePage, total: totalPages })}
                    </span>
                    <button
                        type="button"
                        onClick={() => onQueryChange(prev => ({ ...prev, page: Math.min(totalPages, activePage + 1) }))}
                        disabled={activePage >= totalPages}
                        className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground/20 hover:text-foreground transition-all disabled:opacity-0"
                    >
                        <IconChevronRight className="h-5 w-5" />
                    </button>
                </div>
            ) : null}
        </div>
    );
}

