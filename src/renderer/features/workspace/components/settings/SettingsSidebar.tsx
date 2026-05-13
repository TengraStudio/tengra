/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconBrain, IconFolderOpen, IconGitBranch, IconInfoCircle, IconRobot, IconTerminal } from '@tabler/icons-react';
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
            'flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-sm font-medium transition-all duration-200',
            active
                ? 'border border-primary/10 bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
        )}
    >
        <Icon
            className={cn(
                'w-3.5 h-3.5 transition-colors duration-200',
                active ? 'text-primary' : 'text-muted-foreground/60'
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
    <div className="flex w-64 shrink-0 flex-col gap-1 border-r border-border/10 bg-muted/5 p-3">
        <div className="mb-1 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/40">
            {t('frontend.workspaces.workspaceSettings')}
        </div>

        <NavButton
            active={activeSection === 'general'}
            onClick={() => setActiveSection('general')}
            icon={IconInfoCircle}
            label={t('frontend.workspaces.navigation.general')}
        />
        <NavButton
            active={activeSection === 'workspace'}
            onClick={() => setActiveSection('workspace')}
            icon={IconFolderOpen}
            label={t('frontend.workspaces.navigation.workspace')}
        />
        <NavButton
            active={activeSection === 'intelligence'}
            onClick={() => setActiveSection('intelligence')}
            icon={IconBrain}
            label={t('frontend.workspaces.navigation.intelligence')}
        />
        <NavButton
            active={activeSection === 'council'}
            onClick={() => setActiveSection('council')}
            icon={IconRobot}
            label={t('frontend.workspaces.navigation.council')}
        />
        <NavButton
            active={activeSection === 'git'}
            onClick={() => setActiveSection('git')}
            icon={IconGitBranch}
            label={t('frontend.workspaces.navigation.git')}
        />
        <NavButton
            active={activeSection === 'pipelines'}
            onClick={() => setActiveSection('pipelines')}
            icon={IconTerminal}
            label={t('frontend.workspaces.navigation.pipelines')}
        />
    </div>
);

