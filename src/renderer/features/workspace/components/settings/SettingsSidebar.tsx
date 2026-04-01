import { Bot, Code, Cpu, FileCode2, FolderTree, Info, Play } from 'lucide-react';
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
            'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300',
            active
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105 ring-2 ring-primary/40'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground hover:scale-102'
        )}
    >
        <Icon
            className={cn(
                'w-4 h-4 tw-translate-y-1px transition-transform duration-300',
                active ? 'text-primary-foreground scale-110' : 'text-muted-foreground'
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
    <div className="w-64 border-r border-border/40 flex flex-col p-3 gap-1 shrink-0 bg-background">
        <NavButton
            active={activeSection === 'general'}
            onClick={() => setActiveSection('general')}
            icon={Info}
            label={t('workspaces.general')}
        />
        <NavButton
            active={activeSection === 'council'}
            onClick={() => setActiveSection('council')}
            icon={Bot}
            label={t('workspaces.councilAI')}
        />
        <NavButton
            active={activeSection === 'workspace'}
            onClick={() => setActiveSection('workspace')}
            icon={FolderTree}
            label={t('workspaces.workspace')}
        />
        <div className="h-px bg-muted/60 my-2" />
        <NavButton
            active={activeSection === 'build'}
            onClick={() => setActiveSection('build')}
            icon={Code}
            label={t('workspaces.build')}
        />
        <NavButton
            active={activeSection === 'dev'}
            onClick={() => setActiveSection('dev')}
            icon={Play}
            label={t('workspaces.devServer')}
        />
        <NavButton
            active={activeSection === 'editor'}
            onClick={() => setActiveSection('editor')}
            icon={FileCode2}
            label={t('workspace.editor')}
        />
        <NavButton
            active={activeSection === 'advanced'}
            onClick={() => setActiveSection('advanced')}
            icon={Cpu}
            label={t('workspaces.advanced')}
        />
    </div>
);
