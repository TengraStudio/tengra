import { MemoryStatistics } from '@shared/types/advanced-memory';

import { AnimatedProgressBar } from '@/components/ui/AnimatedProgressBar';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n';

import { CATEGORY_CONFIG } from './constants';

export const StatsPanel = ({ stats }: { stats: MemoryStatistics }) => {
    const { t } = useTranslation();
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 bg-muted/20 border-border/40 space-y-4">
                    <h3 className="font-bold text-sm text-muted-foreground">{t('memory.stats.categoryDistribution')}</h3>
                    <div className="space-y-3">
                        {Object.entries(stats.byCategory).map(([category, count]) => {
                            const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
                            const percentage = (count / stats.total) * 100;
                            return (
                                <div key={category} className="space-y-1">
                                    <div className="flex justify-between text-xs font-medium">
                                        <div className="flex items-center gap-2">
                                            <config.icon className="w-3 h-3" />
                                            {t(config.labelKey)}
                                        </div>
                                        <span>{t('memory.stats.memoriesCount', { count, percent: percentage.toFixed(0) })}</span>
                                    </div>
                                    <AnimatedProgressBar value={percentage} size="sm" />
                                </div>
                            );
                        })}
                    </div>
                </Card>

                <Card className="p-6 bg-muted/20 border-border/40 space-y-4">
                    <h3 className="font-bold text-sm text-muted-foreground">{t('memory.stats.globalContext')}</h3>
                    <div className="flex flex-col items-center justify-center h-48 space-y-4">
                        {/* Placeholder for a chart or visualization */}
                        <div className="text-center">
                            <p className="text-2xl font-bold text-primary">{stats.total}</p>
                            <p className="text-xs text-muted-foreground font-bold">{t('memory.stats.totalActiveFragments')}</p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
