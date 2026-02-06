import React from 'react';

interface SizeConfig {
    containerClass: string
    textSize: string
    strokeWidth: number
    radius: number
    viewBox: string
    center: string
}

const SIZE_CONFIGS: Record<'sm' | 'md', SizeConfig> = {
    sm: { containerClass: 'h-10 w-10', textSize: 'text-xxxs', strokeWidth: 3, radius: 18, viewBox: '0 0 40 40', center: '20' },
    md: { containerClass: 'h-14 w-14', textSize: 'text-xxs', strokeWidth: 4, radius: 25, viewBox: '0 0 60 60', center: '30' }
};

export const QuotaRing = ({ value, color, size = 'md' }: { value: number; color: string; size?: 'sm' | 'md' }) => {
    const config = SIZE_CONFIGS[size];
    const circumference = 2 * Math.PI * config.radius;
    const offset = circumference - (value / 100) * circumference;

    return (
        <div className={`relative ${config.containerClass} flex items-center justify-center shrink-0`}>
            <svg className="absolute inset-0 -rotate-90" viewBox={config.viewBox}>
                <circle
                    cx={config.center}
                    cy={config.center}
                    r={config.radius}
                    stroke="currentColor"
                    strokeWidth={config.strokeWidth}
                    fill="transparent"
                    className="text-foreground/5"
                />
                <circle
                    cx={config.center}
                    cy={config.center}
                    r={config.radius}
                    stroke={color}
                    strokeWidth={config.strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-700 ease-out drop-shadow-[0_0_8px_var(--ring-glow)]"
                    style={{ '--ring-glow': color } as React.CSSProperties}
                />
            </svg>
            <span className={`${config.textSize} font-black tracking-tighter text-foreground/90 tabular-nums`}>
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
