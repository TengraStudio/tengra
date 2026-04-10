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
    <section className={cn('rounded-lg border border-border/40 bg-card p-4 md:p-5', className)}>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    {Icon && <Icon className="h-4 w-4 text-primary" />}
                    <h3 className="text-base font-semibold text-foreground">{title}</h3>
                </div>
                {description && (
                    <p className="flex max-w-2xl items-center gap-1.5 text-sm leading-relaxed text-muted-foreground">
                        <Info className="h-3 w-3 shrink-0" />
                        {description}
                    </p>
                )}
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
        </div>
        <div className="space-y-4">
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
    <div className={cn('grid gap-2', className)}>
        <label htmlFor={id} className="select-none pl-0.5 typo-caption font-medium text-muted-foreground">
            {label}
        </label>
        {description && (
            <p className="px-0.5 typo-caption leading-relaxed text-muted-foreground/80">
                {description}
            </p>
        )}
        <div className="relative">
            {children}
        </div>
    </div>
);

export const SettingsInputClassName =
    'h-9 w-full rounded-md border border-border/50 bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring';

export const SettingsToggleRow: React.FC<{
    title: string
    description: string
    control: React.ReactNode
    icon?: React.ComponentType<{ className?: string }>
}> = ({ title, description, control, icon: Icon }) => (
    <div className="flex flex-col gap-3 rounded-md border border-border/40 bg-background px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        <div className="flex gap-3">
            {Icon && <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />}
            <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">{title}</div>
                <div className="max-w-xl typo-caption leading-relaxed text-muted-foreground">{description}</div>
            </div>
        </div>
        <div className="flex min-h-9 items-center justify-start sm:shrink-0 sm:justify-center">
            {control}
        </div>
    </div>
);
