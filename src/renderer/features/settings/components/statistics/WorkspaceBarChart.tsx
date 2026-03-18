import { formatTime } from '@/lib/formatters';

export const WorkspaceBarChart = ({ workspaces, maxTime }: { workspaces: Array<{ id: string; title: string; time: number }>; maxTime: number }) => {
    return (
        <div className="space-y-3">
            {workspaces.map(({ id, title, time }) => {
                const percentage = maxTime > 0 ? (time / maxTime) * 100 : 0;
                return (
                    <div key={id} className="space-y-2 rounded-xl border border-border/40 bg-card px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                            <span className="flex-1 truncate text-sm font-medium text-foreground">{title}</span>
                            <span className="ml-2 flex-shrink-0 text-sm font-semibold text-foreground">{formatTime(time)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted/30">
                            <div
                                className="h-full rounded-full bg-primary transition-all duration-500"
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                        </div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
                            {Math.round(percentage)}%
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
