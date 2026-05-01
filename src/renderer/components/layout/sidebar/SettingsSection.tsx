/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconActivity, IconBrain, IconChevronDown, IconDatabase, IconInfoCircle, IconLayoutGrid, IconMicrophone, IconPhoto, IconPuzzle, IconSettings, IconTerminal, IconTrendingUp, IconUserCircle } from '@tabler/icons-react';
import React, { ComponentType, useState } from 'react';

import { Button } from '@/components/ui/button';
import { SettingsCategory } from '@/features/settings/types';
import { AppView } from '@/hooks/useAppState';
import { Language, useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

const SettingsMenuItem: React.FC<{
    id: string;
    icon: ComponentType<{ className?: string }>;
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ icon: Icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md typo-caption font-medium transition-all duration-200',
            isActive
                ? 'text-primary bg-primary/5'
                : 'text-muted-foreground hover:bg-muted/10 hover:text-foreground'
        )}
    >
        <Icon className="w-3.5 h-3.5 opacity-70" />
        <span>{label}</span>
    </button>
);

interface SettingsSectionProps {
    isCollapsed: boolean;
    currentView: AppView;
    settingsCategory: SettingsCategory;
    onOpenSettings: (category?: SettingsCategory) => void;
    setSettingsCategory: (category: SettingsCategory) => void;
    language: string;
}

export const SettingsSectionComponent: React.FC<SettingsSectionProps> = ({
    isCollapsed,
    currentView,
    settingsCategory,
    onOpenSettings,
    setSettingsCategory,
    language,
}) => {
    const { t } = useTranslation(language as Language);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const getLabelForId = (id: SettingsCategory): string => {
        switch (id) {
            case 'editor':
                return t('frontend.settings.tabs.editor');
            case 'appearance':
                return t('frontend.settings.tabs.appearance');
            case 'system':
                return t('frontend.settings.tabs.system');
            case 'accounts':
                return t('frontend.settings.tabs.accounts');
            case 'models':
                return t('frontend.settings.tabs.models');
            case 'memory':
                return t('frontend.settings.tabs.memory');
            case 'speech':
                return t('frontend.settings.tabs.speech');
            case 'statistics':
                return t('frontend.settings.tabs.statistics');
            case 'about':
                return t('frontend.settings.tabs.about');
            case 'images':
                return t('frontend.settings.tabs.images');
            case 'extensions':
                return t('frontend.marketplace.tabs.extensions');
            default:
                return t('frontend.settings.tabs.general');
        }
    };

    if (isCollapsed) {
        return (
            <CollapsedSettings onOpenSettings={onOpenSettings} currentView={currentView} t={t} />
        );
    }

    return (
        <div className="flex flex-col">
            <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={cn(
                    'flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full group',
                    currentView === 'settings'
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/10'
                )}
            >
                <div className="flex items-center gap-3">
                    <IconSettings className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300" />
                    <span>{t('frontend.sidebar.settings')}</span>
                </div>
                <IconChevronDown
                    className={cn(
                        'w-3.5 h-3.5 transition-transform duration-200',
                        isSettingsOpen && 'rotate-180'
                    )}
                />
            </button>

            <AnimatePresence>
                {isSettingsOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="ml-2 pl-2 border-l border-border/30 space-y-0.5">
                            {(
                                [
                                    'general',
                                    'editor',
                                    'accounts',
                                    'models',
                                    'memory',
                                    'usage-limits',
                                    'appearance',
                                    'system',
                                    'speech',
                                    'statistics',
                                    'images',
                                    'extensions',
                                    'about',
                                ] as SettingsCategory[]
                            ).map(id => (
                                <SettingsMenuItem
                                    key={id}
                                    id={id}
                                    icon={getIconForId(id)}
                                    label={getLabelForId(id)}
                                    isActive={currentView === 'settings' && settingsCategory === id}
                                    onClick={() => {
                                        onOpenSettings(id);
                                        setSettingsCategory(id);
                                    }}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const CollapsedSettings: React.FC<{
    onOpenSettings: (cat?: SettingsCategory) => void;
    currentView: AppView;
    t: (key: string) => string;
}> = ({ onOpenSettings, currentView, t }) => (
    <Button
        variant="ghost"
        onClick={() => onOpenSettings()}
        className={cn('nav-item justify-center', currentView === 'settings' && 'nav-item-active')}
        title={t('frontend.sidebar.settings')}
    >
        <IconSettings className="w-4 h-4 shrink-0" />
    </Button>
);

const getIconForId = (id: SettingsCategory) => {
    switch (id) {
        case 'models':
            return IconDatabase;
        case 'memory':
            return IconBrain;
        case 'appearance':
            return IconPhoto;
        case 'images':
            return IconPhoto;
        case 'speech':
            return IconMicrophone;
        case 'statistics':
            return IconActivity;
        case 'about':
            return IconInfoCircle;
        case 'accounts':
            return IconUserCircle;
        case 'editor':
                return IconTerminal;
        case 'system':
                return IconActivity;
        case 'usage-limits':
                return IconTrendingUp;
        case 'extensions':
                return IconPuzzle;
        default:
            return IconLayoutGrid;
    }
};

SettingsSectionComponent.displayName = 'SettingsSection';
