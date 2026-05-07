/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Accessibility Settings Panel
 * Provides UI for configuring accessibility options.
 */

import { IconAccessible, IconArrowRight, IconCommand, IconContrast, IconEye, IconFocus, IconRotate, IconShield, IconVolume } from '@tabler/icons-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { useA11ySettings } from '@/utils/accessibility';

/* Batch-02: Extracted Long Classes */
const C_ACCESSIBILITYSETTINGS_1 = "h-10 px-4 rounded-xl typo-body font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/40 transition-all active:scale-95";
const C_ACCESSIBILITYSETTINGS_2 = "absolute top-0 right-0 p-12 -mr-6 -mt-6 bg-primary/10 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity";
const C_ACCESSIBILITYSETTINGS_3 = "h-5 px-1.5 min-w-8 justify-center rounded bg-background/80 border-border/60 typo-body font-mono font-bold shadow-sm group-hover/row:border-primary/40 group-hover/row:text-primary transition-colors";


interface SettingRowProps {
    icon: React.ReactNode;
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

const SettingRow: React.FC<SettingRowProps> = ({
    icon,
    label,
    description,
    checked,
    onChange,
}) => (
    <div
        className={cn(
            'group flex items-center justify-between p-5 rounded-2xl transition-all duration-300 border shadow-sm',
            checked
                ? 'bg-primary/[0.03] border-primary/20 shadow-primary/5'
                : 'bg-card border-border/40 hover:bg-muted/10 hover:border-border/60 hover:shadow-md'
        )}
    >
        <div className="flex items-start gap-4">
            <div
                className={cn(
                    'p-2.5 rounded-xl transition-all shadow-sm ring-1',
                    checked
                        ? 'bg-primary/20 text-primary ring-primary/30'
                        : 'bg-muted/40 text-muted-foreground ring-border/30 group-hover:bg-muted/60'
                )}
            >
                {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-foreground">
                    {label}
                </h4>
                <p className="text-sm text-muted-foreground mt-1 font-medium leading-relaxed opacity-80">
                    {description}
                </p>
            </div>
        </div>
        <Switch
            checked={checked}
            onCheckedChange={onChange}
            aria-label={label}
            className="data-[state=checked]:bg-primary shadow-sm"
        />
    </div>
);

export const AccessibilitySettings: React.FC = () => {
    const { t } = useTranslation();
    const { settings, updateSettings, toggleHighContrast, toggleEnhancedFocus } = useA11ySettings();

    const handleReset = () => {
        updateSettings({
            highContrast: false,
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            screenReaderAnnouncements: true,
            enhancedFocusIndicators: false,
        });
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20">
                        <IconAccessible className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">
                            {t('frontend.settings.accessibility.title')}
                        </h2>
                        <p className="typo-body text-muted-foreground font-bold opacity-70">
                            {t('frontend.settings.accessibility.description')}
                        </p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className={C_ACCESSIBILITYSETTINGS_1}
                >
                    <IconRotate className="w-3.5 h-3.5 mr-2" />
                    {t('common.reset')}
                </Button>
            </div>

            {/* Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SettingRow
                    icon={<IconContrast />}
                    label={t('frontend.settings.accessibility.highContrast')}
                    description={t('frontend.settings.accessibility.highContrastDesc')}
                    checked={settings.highContrast}
                    onChange={toggleHighContrast}
                />

                <SettingRow
                    icon={<IconEye />}
                    label={t('frontend.settings.accessibility.reducedMotion')}
                    description={t('frontend.settings.accessibility.reducedMotionDesc')}
                    checked={settings.reducedMotion}
                    onChange={() => updateSettings({ reducedMotion: !settings.reducedMotion })}
                />

                <SettingRow
                    icon={<IconFocus />}
                    label={t('frontend.settings.accessibility.enhancedFocus')}
                    description={t('frontend.settings.accessibility.enhancedFocusDesc')}
                    checked={settings.enhancedFocusIndicators}
                    onChange={toggleEnhancedFocus}
                />

                <SettingRow
                    icon={<IconVolume />}
                    label={t('frontend.settings.accessibility.screenReader')}
                    description={t('frontend.settings.accessibility.screenReaderDesc')}
                    checked={settings.screenReaderAnnouncements}
                    onChange={checked => updateSettings({ screenReaderAnnouncements: checked })}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                {/* System Preferences Info */}
                <div className="p-6 rounded-3xl bg-primary/03 border border-primary/20 shadow-xl shadow-primary/5 relative overflow-hidden group">
                    <div className={C_ACCESSIBILITYSETTINGS_2} />
                    <div className="flex items-center gap-3 mb-4 relative z-10">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                            <IconShield className="w-4 h-4" />
                        </div>
                        <h4 className="typo-body font-bold text-foreground">
                            {t('frontend.settings.accessibility.systemPrefs')}
                        </h4>
                    </div>
                    <p className="typo-body text-muted-foreground font-medium leading-relaxed relative z-10 opacity-80">
                        {t('frontend.settings.accessibility.systemPrefsDesc')}
                    </p>
                </div>

                {/* Keyboard Shortcuts Info */}
                <div className="p-6 rounded-3xl bg-muted/20 border border-border/40 shadow-inner group transition-all hover:bg-muted/30">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-xl bg-muted/40 text-muted-foreground border border-border/40 group-hover:text-foreground">
                            <IconCommand className="w-4 h-4" />
                        </div>
                        <h4 className="typo-body font-bold text-foreground">
                            {t('frontend.settings.accessibility.shortcuts')}
                        </h4>
                    </div>
                    <div className="space-y-3 px-1">
                        {[
                            {
                                key: t('frontend.settings.accessibility.shortcutTab'),
                                action: t('frontend.settings.accessibility.tabNav'),
                            },
                            {
                                key: t('frontend.settings.accessibility.shortcutShiftTab'),
                                action: t('frontend.settings.accessibility.tabNavBack'),
                            },
                            {
                                key: t('frontend.settings.accessibility.shortcutEnterSpace'),
                                action: t('frontend.settings.accessibility.activate'),
                            },
                            {
                                key: t('frontend.settings.accessibility.shortcutEscape'),
                                action: t('frontend.settings.accessibility.escape'),
                            },
                            {
                                key: t('frontend.settings.accessibility.shortcutArrowKeys'),
                                action: t('frontend.settings.accessibility.arrowNav'),
                            },
                        ].map(({ key, action }, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between group/row hover:translate-x-1 transition-transform"
                            >
                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant="outline"
                                        className={C_ACCESSIBILITYSETTINGS_3}
                                    >
                                        {key}
                                    </Badge>
                                    <IconArrowRight className="w-2.5 h-2.5 text-muted-foreground/30 opacity-0 group-hover/row:opacity-100 transition-all" />
                                </div>
                                <span className="typo-body text-muted-foreground font-bold opacity-60 group-hover/row:opacity-100 transition-opacity">
                                    {action}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccessibilitySettings;

