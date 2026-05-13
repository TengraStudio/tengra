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
import * as React from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    SelectContent,
    SelectItem,
    SelectTrigger,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const SETTINGS_CANVAS_CLASS = 'flex w-full flex-col gap-6 pb-10';
const SETTINGS_SECTION_CARD_CLASS = 'overflow-hidden rounded-[1.5rem] border border-border/25 bg-card/70 shadow-sm';
const SETTINGS_SECTION_HEADER_CLASS = 'flex flex-col gap-3 border-b border-border/10 px-5 py-5 sm:px-6';
const SETTINGS_SECTION_TITLE_CLASS = 'text-lg font-semibold tracking-tight text-foreground';
const SETTINGS_SECTION_DESCRIPTION_CLASS = 'max-w-2xl text-sm leading-relaxed text-muted-foreground/75';
const SETTINGS_ROW_CLASS = 'flex flex-col gap-4 rounded-2xl border border-border/15 bg-background/50 px-4 py-4 transition-colors hover:border-border/25 sm:flex-row sm:items-start sm:justify-between sm:gap-5';
const SETTINGS_LABEL_CLASS = 'select-none pl-0.5 typo-caption font-medium text-muted-foreground';
const SETTINGS_INPUT_CLASS = 'h-11 w-full rounded-2xl border border-border/30 bg-muted/10 px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-primary/35 focus-visible:ring-1 focus-visible:ring-ring';
const SETTINGS_TEXTAREA_CLASS = 'min-h-84 w-full rounded-2xl border border-border/30 bg-muted/10 px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-primary/35 focus-visible:ring-1 focus-visible:ring-ring';
const SETTINGS_SELECT_TRIGGER_CLASS = 'h-11 w-full rounded-2xl border border-border/30 bg-muted/10 px-4 text-sm text-foreground shadow-none transition-colors focus-visible:border-primary/35 focus-visible:ring-1 focus-visible:ring-ring';
const SETTINGS_SELECT_CONTENT_CLASS = 'rounded-2xl border border-border/25 bg-popover/98 shadow-xl';
const SETTINGS_SELECT_ITEM_CLASS = 'relative flex w-full cursor-default select-none items-center rounded-xl py-2 pl-8 pr-3 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50';
const SETTINGS_SWITCH_CLASS = 'h-7 w-12 shrink-0 border border-border/25 bg-muted/30 data-[state=checked]:border-primary/40 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input/80';

export const SETTINGS_TAB_CONTAINER_CLASS = SETTINGS_CANVAS_CLASS;
export const SETTINGS_PANEL_CLASS = SETTINGS_SECTION_CARD_CLASS;
export const SETTINGS_SUBSECTION_CLASS = 'rounded-2xl border border-border/15 bg-background/50 p-4 sm:p-5';
export const SETTINGS_META_CARD_CLASS = 'rounded-2xl border border-border/15 bg-background/50 p-4';
export const SETTINGS_SEGMENTED_CONTROL_CLASS = 'flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/20 bg-muted/10 p-1.5';
export const SETTINGS_SEGMENTED_ITEM_CLASS = 'flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors';
export const SettingsInputClassName = SETTINGS_INPUT_CLASS;

export const SettingsCard: React.FC<
    React.ComponentPropsWithoutRef<typeof Card>
> = ({ className, ...props }) => (
    <Card
        className={cn(SETTINGS_SECTION_CARD_CLASS, className)}
        {...props}
    />
);

export const SettingsCardHeader: React.FC<
    React.ComponentPropsWithoutRef<typeof CardHeader>
> = ({ className, ...props }) => (
    <CardHeader
        className={cn(SETTINGS_SECTION_HEADER_CLASS, className)}
        {...props}
    />
);

export const SettingsCardTitle: React.FC<
    React.ComponentPropsWithoutRef<typeof CardTitle>
> = ({ className, ...props }) => (
    <CardTitle className={cn(SETTINGS_SECTION_TITLE_CLASS, className)} {...props} />
);

export const SettingsCardDescription: React.FC<
    React.ComponentPropsWithoutRef<typeof CardDescription>
> = ({ className, ...props }) => (
    <CardDescription className={cn(SETTINGS_SECTION_DESCRIPTION_CLASS, className)} {...props} />
);

export const SettingsCardContent: React.FC<
    React.ComponentPropsWithoutRef<typeof CardContent>
> = ({ className, ...props }) => (
    <CardContent className={cn('px-5 pb-5 pt-0 sm:px-6', className)} {...props} />
);

export const SettingsInput: React.FC<
    React.ComponentPropsWithoutRef<typeof Input>
> = ({ className, ...props }) => (
    <Input className={cn(SETTINGS_INPUT_CLASS, className)} {...props} />
);

export const SettingsTextarea: React.FC<
    React.ComponentPropsWithoutRef<typeof Textarea>
> = ({ className, ...props }) => (
    <Textarea className={cn(SETTINGS_TEXTAREA_CLASS, className)} {...props} />
);

export const SettingsSelectTrigger: React.FC<
    React.ComponentPropsWithoutRef<typeof SelectTrigger>
> = ({ className, ...props }) => (
    <SelectTrigger className={cn(SETTINGS_SELECT_TRIGGER_CLASS, className)} {...props} />
);

export const SettingsSelectContent: React.FC<
    React.ComponentPropsWithoutRef<typeof SelectContent>
> = ({ className, ...props }) => (
    <SelectContent className={cn(SETTINGS_SELECT_CONTENT_CLASS, className)} {...props} />
);

export const SettingsSelectItem: React.FC<
    React.ComponentPropsWithoutRef<typeof SelectItem>
> = ({ className, ...props }) => (
    <SelectItem className={cn(SETTINGS_SELECT_ITEM_CLASS, className)} {...props} />
);

export const SettingsSwitch: React.FC<
    React.ComponentPropsWithoutRef<typeof Switch>
> = ({ className, ...props }) => (
    <Switch className={cn(SETTINGS_SWITCH_CLASS, className)} {...props} />
);

export const SettingsTabLayout: React.FC<{
    children: React.ReactNode
    className?: string
}> = ({ children, className }) => (
    <div className={cn(SETTINGS_TAB_CONTAINER_CLASS, className)}>
        {children}
    </div>
);

export const SettingsTabHeader: React.FC<{
    title?: string
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
                {title && (
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                        {title}
                    </h2>
                )}
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
    title?: string
    description?: string
    actions?: React.ReactNode
    children: React.ReactNode
    className?: string
    icon?: React.ComponentType<{ className?: string }>
}> = ({ title, description, actions, children, className, icon: Icon }) => (
    <SettingsCard className={className}>
        {(title || description || actions || Icon) && (
            <div className="flex flex-col gap-4 px-5 py-5 sm:px-6 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        {Icon && <Icon className="h-4 w-4 text-primary" />}
                        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
                    </div>
                    {description && (
                        <p className="flex max-w-2xl items-center gap-1.5 text-sm leading-relaxed text-muted-foreground/75">
                            <IconInfoCircle className="h-3 w-3 shrink-0" />
                            {description}
                        </p>
                    )}
                </div>
                {actions && <div className="shrink-0">{actions}</div>}
            </div>
        )}
        <div>
            {children}
        </div>
    </SettingsCard>
);

export const SettingsField: React.FC<{
    label: string
    description?: string
    children: React.ReactNode
    className?: string
    id?: string
}> = ({ label, description, children, className, id }) => (
    <div className={cn('grid gap-2', className)}>
        <label htmlFor={id} className={SETTINGS_LABEL_CLASS}>
            {label}
        </label>
        {description && (
            <p className="px-0.5 typo-caption leading-relaxed text-muted-foreground/70">
                {description}
            </p>
        )}
        <div className="relative">
            {children}
        </div>
    </div>
);

export const SettingsToggleRow: React.FC<{
    title: string
    description: string
    control: React.ReactNode
    icon?: React.ComponentType<{ className?: string }>
}> = ({ title, description, control, icon: Icon }) => (
    <div className={SETTINGS_ROW_CLASS}>
        <div className="flex gap-3">
            {Icon && <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />}
            <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">{title}</div>
                <div className="max-w-xl typo-caption leading-relaxed text-muted-foreground/70">{description}</div>
            </div>
        </div>
        <div className="flex min-h-9 items-center justify-start sm:shrink-0 sm:justify-center">
            {control}
        </div>
    </div>
);

