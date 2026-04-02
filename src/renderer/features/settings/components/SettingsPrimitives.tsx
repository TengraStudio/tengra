import { cn } from '@renderer/lib/utils';
import { Info } from 'lucide-react';
import React from 'react';

export const SettingsPanel: React.FC<{
    title: string
    description?: string
    actions?: React.ReactNode
    children: React.ReactNode
    className?: string
    icon?: React.ComponentType<{ className?: string }>
}> = ({ title, description, actions, children, className, icon: Icon }) => (
    <section className={cn('rounded-3xl border border-border/20 bg-muted/5 p-5 md:p-7 transition-colors hover:bg-muted/8', className)}>
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    {Icon && <Icon className="w-5 h-5 text-primary" />}
                    <h3 className="text-xl font-semibold text-foreground">{title}</h3>
                </div>
                {description && (
                    <p className="flex max-w-2xl items-center gap-2 text-[11px] leading-relaxed text-muted-foreground opacity-70">
                        <Info className="w-3 h-3 shrink-0" />
                        {description}
                    </p>
                )}
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
        </div>
        <div className="space-y-5">
            {children}
        </div>
    </section>
);

export const SettingsField: React.FC<{
    label: string
    description?: string
    children: React.ReactNode
    className?: string
    id?: string
}> = ({ label, description, children, className, id }) => (
    <div className={cn('grid gap-2.5', className)}>
        <label htmlFor={id} className="text-[10px] font-bold text-muted-foreground/80 pl-1 select-none">
            {label}
        </label>
        {description && (
            <p className="text-[10px] leading-relaxed text-muted-foreground/60 px-1">
                {description}
            </p>
        )}
        <div className="relative group/field">
            {children}
        </div>
    </div>
);

export const SettingsInputClassName =
    'w-full h-11 rounded-2xl border border-border/30 bg-background px-4 py-3 text-xs font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-primary/35 hover:border-border/50';

export const SettingsToggleRow: React.FC<{
    title: string
    description: string
    control: React.ReactNode
    icon?: React.ComponentType<{ className?: string }>
}> = ({ title, description, control, icon: Icon }) => (
    <div className="group/toggle flex flex-col gap-4 rounded-2xl border border-border/20 bg-background/50 px-4 py-4 transition-colors hover:bg-muted/5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex gap-4">
            {Icon && <Icon className="w-5 h-5 text-primary/40 group-hover/toggle:text-primary transition-colors mt-0.5" />}
            <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-foreground group-hover/toggle:text-primary transition-colors">{title}</div>
                <div className="max-w-xl text-[10px] leading-relaxed text-muted-foreground opacity-75 group-hover/toggle:opacity-100 transition-opacity">{description}</div>
            </div>
        </div>
        <div className="flex min-h-[40px] items-center justify-start pt-0.5 sm:shrink-0 sm:justify-center">
            {control}
        </div>
    </div>
);
