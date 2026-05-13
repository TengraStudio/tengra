/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import logoBlack from '@assets/tengra_black.png';
import logoWhite from '@assets/tengra_white.png';
import { IconAlertTriangle, IconBolt, IconDeviceMobile, IconExternalLink, IconGlobe, IconRefresh } from '@tabler/icons-react';
import React, { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';

import {
    SettingsPanel,
    SettingsTabHeader,
    SettingsTabLayout,
} from './SettingsPrimitives';

/* Batch-02: Extracted Long Classes */
const C_ABOUTTAB_1 = "relative mb-2 flex h-28 w-28 items-center justify-center rounded-card-lg border border-border/20 bg-muted/10 sm:h-32 sm:w-32";
const C_ABOUTTAB_3 = "group/btn h-12 rounded-2xl border-border/30 bg-background typo-body font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground";
const C_ABOUTTAB_4 = "group/btn h-12 rounded-2xl border-border/30 bg-background typo-body font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground";
const C_ABOUTTAB_6 = "flex flex-col justify-between gap-4 rounded-card-lg border border-border/20 bg-muted/5 p-5 transition-colors hover:bg-muted/10 sm:col-span-2 md:flex-row md:items-center";
const C_ABOUTTAB_7 = "overflow-hidden rounded-3xl border border-destructive/20 bg-destructive/5 p-6 transition-colors hover:bg-destructive/10 sm:p-8";


interface AboutTabProps {
    onReset: () => void;
    t: (key: string) => string;
}

declare const __BUILD_TIME__: number;
declare const __APP_VERSION__: string;

export const AboutTab: React.FC<AboutTabProps> = ({ onReset, t }) => {
    const { isLight } = useTheme();

    const logo = useMemo(() => {
        return isLight ? logoBlack : logoWhite;
    }, [isLight]);

    return (
        <SettingsTabLayout className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsPanel title={t('frontend.app.name')} icon={IconGlobe} className="text-center">
                <div className="flex flex-col items-center space-y-8 px-6 py-2">
                    <div className="relative">
                        <div className={C_ABOUTTAB_1}>
                            <img
                                src={logo}
                                alt={t('frontend.app.name')}
                                className="h-16 w-16 opacity-90 brightness-110"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-4xl font-semibold leading-none text-foreground sm:text-5xl">
                            {t('frontend.app.name')}
                        </h2>
                    </div>

                    <div className="grid w-full max-w-md grid-cols-1 gap-4 sm:grid-cols-2">
                        <Button
                            variant="outline"
                            onClick={() =>
                                window.electron.openExternal('https://github.com/TengraStudio/tengra')
                            }
                            className={C_ABOUTTAB_3}
                        >
                            <IconExternalLink className="mr-3 h-4 w-4" />
                            {t('frontend.about.privacyPolicy')}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() =>
                                window.electron.openExternal('https://github.com/TengraStudio/tengra')
                            }
                            className={C_ABOUTTAB_4}
                        >
                            <IconGlobe className="mr-3 h-4 w-4" />
                            {t('frontend.about.github')}
                        </Button>
                    </div>
                </div>
            </SettingsPanel>

            <SettingsPanel title={t('frontend.about.buildVersion')} icon={IconBolt}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 px-6 py-2">
                    <div className="rounded-card-lg border border-border/20 bg-muted/5 p-5 transition-colors hover:bg-muted/10">
                        <div className="flex items-center gap-2 mb-4">
                            <IconDeviceMobile className="w-3.5 h-3.5 text-primary/60" />
                            <div className="typo-body font-medium text-muted-foreground/60">
                                {t('frontend.advanced.platform')}
                            </div>
                        </div>
                        <div className="text-sm font-bold text-foreground truncate">
                            {navigator.platform}
                        </div>
                    </div>


                    <div className={C_ABOUTTAB_6}>
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2">
                                <IconBolt className="w-3.5 h-3.5 text-primary/60" />
                                <div className="typo-body font-medium text-muted-foreground/60">
                                    {t('frontend.about.buildVersion')}
                                </div>
                            </div>
                            <div className="text-sm font-medium text-primary">
                                {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'N/A'}
                            </div>
                        </div> 
                    </div>
                </div>
            </SettingsPanel>

            <div className={C_ABOUTTAB_7}>
                <div className="relative z-10 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
                    <div className="text-center md:text-left space-y-4 max-w-xl">
                        <div className="flex items-center gap-4">
                            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-2.5 text-destructive">
                                <IconAlertTriangle className="w-5 h-5" />
                            </div>
                            <h3 className="text-xl font-semibold text-destructive">
                                {t('frontend.about.factoryReset')}
                            </h3>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground/70">
                            {t('frontend.about.factoryResetDesc')}
                        </p>
                    </div>
                    <Button
                        variant="destructive"
                        onClick={onReset}
                        className="h-12 rounded-2xl px-8 typo-body font-medium"
                    >
                        <IconRefresh className="w-4 h-4 mr-3" />
                        {t('frontend.about.executeWipe')}
                    </Button>
                </div>
            </div>
        </SettingsTabLayout>
    );
};



