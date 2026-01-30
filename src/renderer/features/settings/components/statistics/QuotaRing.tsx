import React from 'react';

export const QuotaRing = ({ value, color, size = 'md' }: { value: number; color: string; size?: 'sm' | 'md' }) => {
    const sizeClass = size === 'sm' ? 'h-10 w-10' : 'h-14 w-14';
    const textSize = size === 'sm' ? 'text-[9px]' : 'text-[11px]';
    const strokeWidth = size === 'sm' ? 3 : 4;
    const radius = size === 'sm' ? 18 : 25;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;

    return (
        <div className={`relative ${sizeClass} flex items-center justify-center shrink-0`}>
            <svg className="absolute inset-0 -rotate-90" viewBox={size === 'sm' ? "0 0 40 40" : "0 0 60 60"}>
                <circle
                    cx={size === 'sm' ? "20" : "30"}
                    cy={size === 'sm' ? "20" : "30"}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    className="text-foreground/5"
                />
                <circle
                    cx={size === 'sm' ? "20" : "30"}
                    cy={size === 'sm' ? "20" : "30"}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-700 ease-out drop-shadow-[0_0_8px_var(--ring-glow)]"
                    style={{ '--ring-glow': color } as React.CSSProperties}
                />
            </svg>
            <span className={`${textSize} font-black tracking-tighter text-foreground/90 tabular-nums`}>
                {Math.round(value)}%
            </span>
        </div>
    );
};

export const getQuotaColor = (p: number) => {
    // Using CSS variables for theme-aware quota colors
    if (p <= 10) { return 'hsl(var(--destructive))'; } // Red/destructive
    if (p <= 30) { return 'hsl(var(--warning))'; } // Orange/warning
    if (p <= 60) { return 'hsl(var(--yellow))'; } // Yellow
    return 'hsl(var(--success))'; // Green/success
};
