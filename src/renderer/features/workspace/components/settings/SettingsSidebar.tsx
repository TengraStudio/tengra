import { Bot, Code, Cpu, FolderTree, Info, Play } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

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
                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground hover:scale-102'
        )}
    >
        <Icon
            className={cn(
                'w-4 h-4 translate-y-[1px] transition-transform duration-300',
                active ? 'text-primary-foreground scale-110' : 'text-muted-foreground'
            )}
        />
        {label}
    </button>
);

export const SettingsSidebar: React.FC<{
    activeSection: string;
    setActiveSection: (
        section: 'general' | 'council' | 'workspace' | 'build' | 'dev' | 'advanced'
    ) => void;
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
            label={t('workspaces.workspace') || 'Workspace'}
        />
        <div className="h-px bg-white/10 my-2" />
        <NavButton
            active={activeSection === 'build'}
            onClick={() => setActiveSection('build')}
            icon={Code}
            label={t('workspaces.build') || 'Build & Test'}
        />
        <NavButton
            active={activeSection === 'dev'}
            onClick={() => setActiveSection('dev')}
            icon={Play}
            label={t('workspaces.devServer') || 'Dev Server'}
        />
        <NavButton
            active={activeSection === 'advanced'}
            onClick={() => setActiveSection('advanced')}
            icon={Cpu}
            label={t('workspaces.advanced') || 'Advanced'}
        />
    </div>
);
