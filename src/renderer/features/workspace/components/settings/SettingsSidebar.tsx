/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconBrain, IconCode, IconDatabase, IconFolderOpen, IconGitBranch, IconInfoCircle, IconPlayerPlay, IconRobot, IconTerminal } from '@tabler/icons-react';
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
            'flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200',
            active
                ? 'bg-primary/10 text-primary border border-primary/10'
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
    <div className="w-56 border-r border-border/5 flex flex-col p-2 gap-1 shrink-0 bg-muted/5">
        <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground/30 uppercase tracking-wider mb-1">
            {t('workspaces.workspaceSettings')}
        </div>
        
        <NavButton
            active={activeSection === 'general'}
            onClick={() => setActiveSection('general')}
            icon={IconInfoCircle}
            label={t('workspaces.navigation.general')}
        />
        <NavButton
            active={activeSection === 'workspace'}
            onClick={() => setActiveSection('workspace')}
            icon={IconFolderOpen}
            label={t('workspaces.navigation.workspace')}
        />
        <NavButton
            active={activeSection === 'intelligence'}
            onClick={() => setActiveSection('intelligence')}
            icon={IconBrain}
            label={t('workspaces.navigation.intelligence')}
        />
        <NavButton
            active={activeSection === 'council'}
            onClick={() => setActiveSection('council')}
            icon={IconRobot}
            label={t('workspaces.navigation.council')}
        />
        <NavButton
            active={activeSection === 'git'}
            onClick={() => setActiveSection('git')}
            icon={IconGitBranch}
            label={t('workspaces.navigation.git')}
        />
        <NavButton
            active={activeSection === 'pipelines'}
            onClick={() => setActiveSection('pipelines')}
            icon={IconTerminal}
            label={t('workspaces.navigation.pipelines') || 'Pipelines'}
        />
    </div>
);
