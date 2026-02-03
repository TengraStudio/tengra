import { MemoryStatistics } from '@shared/types/advanced-memory';

import { AnimatedProgressBar } from '@/components/ui/AnimatedProgressBar';
import { Card } from '@/components/ui/card';

import { CATEGORY_CONFIG } from './MemorySubComponents';

export const StatsPanel = ({ stats }: { stats: MemoryStatistics }) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 bg-muted/20 border-white/5 space-y-4">
                    <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Category Distribution</h3>
                    <div className="space-y-3">
                        {Object.entries(stats.byCategory).map(([category, count]) => {
                            const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
                            const percentage = (count / stats.total) * 100;
                            return (
                                <div key={category} className="space-y-1">
                                    <div className="flex justify-between text-xs font-medium">
                                        <div className="flex items-center gap-2">
                                            <config.icon className="w-3 h-3" />
                                            {config.label}
                                        </div>
                                        <span>{count} memories ({percentage.toFixed(0)}%)</span>
                                    </div>
                                    <AnimatedProgressBar value={percentage} size="sm" />
                                </div>
                            );
                        })}
                    </div>
                </Card>

                <Card className="p-6 bg-muted/20 border-white/5 space-y-4">
                    <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Global Context Balance</h3>
                    <div className="flex flex-col items-center justify-center h-48 space-y-4">
                        {/* Placeholder for a chart or visualization */}
                        <div className="text-center">
                            <p className="text-2xl font-black text-primary">{stats.total}</p>
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Total Active Fragments</p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
