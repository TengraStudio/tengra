import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import type { MarketplaceSkill } from '@shared/types/marketplace';
import type { ProxySkill } from '@shared/types/skill';
import { Download, RefreshCw, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { pushNotification } from '@/store/notification-center.store';

export function SkillsMarketplace(): JSX.Element {
    const { t } = useTranslation();
    const [skills, setSkills] = useState<ProxySkill[]>([]);
    const [marketplaceSkills, setMarketplaceSkills] = useState<MarketplaceSkill[]>([]);
    const [loading, setLoading] = useState(true);
    const [installingId, setInstallingId] = useState<string | null>(null);
    const [uninstallingId, setUninstallingId] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [listedSkills, fetchedRegistry] = await Promise.all([
                window.electron.listSkills(),
                window.electron.marketplace.fetch(),
            ]);
            setSkills(listedSkills);
            setMarketplaceSkills(fetchedRegistry.skills ?? []);
        } catch {
            pushNotification({
                type: 'error',
                message: t('marketplace.loadError'),
            });
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const installedSkillIds = useMemo(() => new Set(skills.map(skill => skill.id)), [skills]);

    const handleInstall = useCallback(async (skillId: string) => {
        setInstallingId(skillId);
        try {
            const skillSource = marketplaceSkills.find(s => s.id === skillId);
            if (!skillSource) {
                throw new Error('Skill definition not found in marketplace');
            }
            
            await window.electron.marketplace.install({
                type: 'skill',
                id: skillSource.id,
                name: skillSource.name,
                description: skillSource.description,
                author: skillSource.author,
                version: skillSource.version,
                downloadUrl: skillSource.downloadUrl
            });
            
            await loadData();
            pushNotification({
                type: 'success',
                message: t('marketplace.installSuccess', { name: skillSource.name }),
            });
        } catch {
            pushNotification({
                type: 'error',
                message: t('marketplace.installFailure'),
            });
        } finally {
            setInstallingId(null);
        }
    }, [loadData, marketplaceSkills, t]);

    const handleUninstall = useCallback(async (skillId: string) => {
        setUninstallingId(skillId);
        try {
            await window.electron.deleteSkill(skillId);
            await loadData();
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
    }, [loadData, t]);

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
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
            {marketplaceSkills.map(item => {
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
                            <Badge variant="outline" className="text-[10px] uppercase">
                                {item.provider}
                            </Badge>
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-3">
                            <span className="text-[10px] text-muted-foreground font-semibold">
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
    );
}

