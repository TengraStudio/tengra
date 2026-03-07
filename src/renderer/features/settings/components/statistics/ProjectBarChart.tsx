import { formatTime } from '@/lib/formatters';

export const WorkspaceBarChart = ({ workspaces, maxTime }: { workspaces: Array<{ id: string; title: string; time: number }>; maxTime: number }) => {
    return (
        <div className="space-y-4">
            {workspaces.map(({ id, title, time }) => {
                const percentage = maxTime > 0 ? (time / maxTime) * 100 : 0;
                return (
                    <div key={id} className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground truncate flex-1">{title}</span>
                            <span className="text-sm font-bold text-primary ml-2 flex-shrink-0">{formatTime(time)}</span>
                        </div>
                        <div className="h-2 bg-muted/20 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500 bg-primary"
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
