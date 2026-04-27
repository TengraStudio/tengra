/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { cn } from '@/lib/utils';

export function BadgeQ({ quantization }: { quantization: string }) {
    let color = "bg-muted text-muted-foreground";
    const q = quantization.toUpperCase();
    if (q.includes("Q4")) { color = "bg-success/10 text-success"; }
    else if (q.includes("Q5")) { color = "bg-primary/10 text-primary"; }
    else if (q.includes("Q6") || q.includes("Q8")) { color = "bg-accent/10 text-accent"; }
    else if (q.includes("Q2") || q.includes("Q3")) { color = "bg-destructive/10 text-destructive"; }
    else if (q.includes("SAFETENSORS")) { color = "bg-info/10 text-info"; }
    else if (q.includes("CKPT")) { color = "bg-warning/10 text-warning"; }

    return (
        <span className={cn("text-sm font-bold px-1.5 py-0.5 rounded", color)}>
            {q}
        </span>
    );
}
