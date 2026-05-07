/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconInfoCircle } from '@tabler/icons-react';
import React from 'react';

import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_SETTINGSPRIMITIVES_1 = "flex flex-col gap-3 rounded-md border border-border/40 bg-background px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5";

export const SETTINGS_TAB_CONTAINER_CLASS = 'mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10';
export const SETTINGS_PANEL_CLASS = 'rounded-3xl border border-border/25 bg-card p-5 shadow-sm sm:p-6 lg:p-8';
export const SETTINGS_SUBSECTION_CLASS = 'rounded-2xl border border-border/15 bg-muted/10 p-4 sm:p-5';
export const SETTINGS_META_CARD_CLASS = 'rounded-2xl border border-border/15 bg-muted/10 p-4';
export const SETTINGS_SEGMENTED_CONTROL_CLASS = 'flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/20 bg-muted/10 p-1.5';
export const SETTINGS_SEGMENTED_ITEM_CLASS = 'flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors';

export const SettingsTabLayout: React.FC<{
    children: React.ReactNode
    className?: string
}> = ({ children, className }) => (
    <div className={cn(SETTINGS_TAB_CONTAINER_CLASS, className)}>
        {children}
    </div>
);

export const SettingsTabHeader: React.FC<{
    title: string
    description?: string
    icon?: React.ComponentType<{ className?: string }>
    actions?: React.ReactNode
    className?: string
}> = ({ title, description, icon: Icon, actions, className }) => (
    <header className={cn('flex flex-col gap-4 px-1 md:flex-row md:items-start md:justify-between', className)}>
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                {Icon && (
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                    </div>
                )}
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    {title}
                </h2>
            </div>
            {description && (
                <p className="max-w-2xl pl-0.5 text-sm leading-relaxed text-muted-foreground/75">
                    {description}
                </p>
            )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
    </header>
);

export const SettingsStatGrid: React.FC<{
    children: React.ReactNode
    className?: string
}> = ({ children, className }) => (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>
        {children}
    </div>
);

export const SettingsStatCard: React.FC<{
    label: string
    value: React.ReactNode
    tone?: 'default' | 'success' | 'destructive' | 'primary'
    className?: string
}> = ({ label, value, tone = 'default', className }) => (
    <div className={cn(SETTINGS_META_CARD_CLASS, className)}>
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
            {label}
        </div>
        <div className={cn(
            'mt-2 text-xl font-semibold text-foreground',
            tone === 'success' && 'text-success',
            tone === 'destructive' && 'text-destructive',
            tone === 'primary' && 'text-primary'
        )}>
            {value}
        </div>
    </div>
);


export const SettingsPanel: React.FC<{
    title: string
    description?: string
    actions?: React.ReactNode
    children: React.ReactNode
    className?: string
    icon?: React.ComponentType<{ className?: string }>
}> = ({ title, description, actions, children, className, icon: Icon }) => (
    <section className={cn(SETTINGS_PANEL_CLASS, className)}>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    {Icon && <Icon className="h-4 w-4 text-primary" />}
                    <h3 className="text-base font-semibold text-foreground">{title}</h3>
                </div>
                {description && (
                    <p className="flex max-w-2xl items-center gap-1.5 text-sm leading-relaxed text-muted-foreground">
                        <IconInfoCircle className="h-3 w-3 shrink-0" />
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
    'h-11 w-full rounded-2xl border border-border/35 bg-muted/15 px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-primary/35 focus-visible:ring-1 focus-visible:ring-ring';

export const SettingsToggleRow: React.FC<{
    title: string
    description: string
    control: React.ReactNode
    icon?: React.ComponentType<{ className?: string }>
}> = ({ title, description, control, icon: Icon }) => (
    <div className={C_SETTINGSPRIMITIVES_1}>
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

