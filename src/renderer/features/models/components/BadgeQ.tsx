import { cn } from '@/lib/utils';

export function BadgeQ({ quantization }: { quantization: string }) {
    let color = "bg-muted text-muted-foreground";
    if (quantization.includes("Q4")) { color = "bg-success/10 text-success"; }
    else if (quantization.includes("Q5")) { color = "bg-primary/10 text-primary"; }
    else if (quantization.includes("Q6") || quantization.includes("Q8")) { color = "bg-purple/10 text-purple"; }
    else if (quantization.includes("Q2") || quantization.includes("Q3")) { color = "bg-destructive/10 text-destructive"; }

    return (
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", color)}>
            {quantization}
        </span>
    );
}
