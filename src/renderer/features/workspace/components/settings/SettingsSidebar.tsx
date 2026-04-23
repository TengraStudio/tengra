/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Bot, Brain, Code, Database, FolderTree, GitBranch, Info, Play, Terminal } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

import { WorkspaceSettingsSection } from './types';

interface NavButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ElementType;
    label: string;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon: Icon, label }) => (
    <button
        onClick={onClick}
        className={cn(
            'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300',
            active
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-102 ring-1 ring-primary/30'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground hover:translate-x-1'
        )}
    >
        <Icon
            className={cn(
                'w-4 h-4 transition-transform duration-300',
                active ? 'text-primary-foreground' : 'text-muted-foreground'
            )}
        />
        {label}
    </button>
);

export const SettingsSidebar: React.FC<{
    activeSection: WorkspaceSettingsSection;
    setActiveSection: (section: WorkspaceSettingsSection) => void;
    t: (key: string) => string;
}> = ({ activeSection, setActiveSection, t }) => (
    <div className="w-64 border-r border-border/40 flex flex-col p-4 gap-4 shrink-0 bg-background/30 backdrop-blur-xl">
        <div className="space-y-1">
            <h3 className="px-4 typo-overline font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">{t('workspaces.coreCategory')}</h3>
            <NavButton
                active={activeSection === 'general'}
                onClick={() => setActiveSection('general')}
                icon={Info}
                label={t('workspaces.navigation.general')}
            />
            <NavButton
                active={activeSection === 'workspace'}
                onClick={() => setActiveSection('workspace')}
                icon={FolderTree}
                label={t('workspaces.navigation.workspace')}
            />
        </div>

        <div className="space-y-1">
            <h3 className="px-4 typo-overline font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">{t('workspaces.intelligenceCategory')}</h3>
            <NavButton
                active={activeSection === 'intelligence'}
                onClick={() => setActiveSection('intelligence')}
                icon={Brain}
                label={t('workspaces.navigation.intelligence')}
            />
            <NavButton
                active={activeSection === 'council'}
                onClick={() => setActiveSection('council')}
                icon={Bot}
                label={t('workspaces.navigation.council')}
            />
            <NavButton
                active={activeSection === 'git'}
                onClick={() => setActiveSection('git')}
                icon={GitBranch}
                label={t('workspaces.navigation.git')}
            />
            <NavButton
                active={activeSection === 'environment'}
                onClick={() => setActiveSection('environment')}
                icon={Terminal}
                label={t('workspaces.navigation.environment')}
            />
        </div>

        <div className="space-y-1">
            <h3 className="px-4 typo-overline font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">{t('workspaces.developmentCategory')}</h3>
            <NavButton
                active={activeSection === 'build'}
                onClick={() => setActiveSection('build')}
                icon={Code}
                label={t('workspaces.navigation.build')}
            />
            <NavButton
                active={activeSection === 'dev'}
                onClick={() => setActiveSection('dev')}
                icon={Play}
                label={t('workspaces.navigation.devServer')}
            />
        </div>

        <div className="space-y-1">
            <h3 className="px-4 typo-overline font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">{t('workspaces.advancedCategory')}</h3>
            <NavButton
                active={activeSection === 'advanced'}
                onClick={() => setActiveSection('advanced')}
                icon={Database}
                label={t('workspaces.navigation.advanced')}
            />
        </div>
    </div>
);
