import { formatTime } from '@/lib/formatters';

export const TimeBarChart = ({ value, maxValue, label, color = 'hsl(var(--primary))' }: { value: number; maxValue: number; label: string; color?: string }) => {
    const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <span className="text-sm font-bold text-foreground">{formatTime(value)}</span>
            </div>
            <div className="h-3 bg-muted/20 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(percentage, 100)}%`, background: color }}
                />
            </div>
        </div>
    );
};
