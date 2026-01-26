import {
Activity, ChevronDown, Cpu, Database, Image, Info,
LayoutGrid,
Mic,     Settings,     Terminal, TrendingUp, UserCircle} from 'lucide-react';
import React, { ComponentType,useState } from 'react';

import { Button } from '@/components/ui/button';
import { SettingsCategory } from '@/features/settings/types';
import { AppView } from '@/hooks/useAppState';
import { Language,useTranslation } from '@/i18n';
import { AnimatePresence,motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

const SettingsMenuItem: React.FC<{
    id: string;
    icon: ComponentType<{ className?: string }>;
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({
    icon: Icon,
    label,
    isActive,
    onClick
}) => (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200",
                isActive
                    ? "text-primary bg-primary/5"
                    : "text-muted-foreground hover:bg-muted/10 hover:text-foreground"
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
    language
}) => {
    const { t } = useTranslation(language as Language);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    if (isCollapsed) {
        return <CollapsedSettings onOpenSettings={onOpenSettings} currentView={currentView} t={t} />;
    }

    return (
        <div className="flex flex-col">
            <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full group",
                    currentView === 'settings' ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                )}
            >
                <div className="flex items-center gap-3">
                    <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300" />
                    <span>{t('sidebar.settings')}</span>
                </div>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isSettingsOpen && "rotate-180")} />
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
                            {(['general', 'accounts', 'models', 'usage-limits', 'appearance', 'speech', 'advanced', 'developer', 'statistics', 'gallery', 'about'] as SettingsCategory[]).map(id => (
                                <SettingsMenuItem
                                    key={id}
                                    id={id}
                                    icon={getIconForId(id)}
                                    label={t(`settings.${id}`)}
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

const CollapsedSettings: React.FC<{ onOpenSettings: (cat?: SettingsCategory) => void, currentView: AppView, t: (key: string) => string }> = ({ onOpenSettings, currentView, t }) => (
    <Button
        variant="ghost"
        onClick={() => onOpenSettings()}
        className={cn(
            "nav-item justify-center",
            currentView === 'settings' && "nav-item-active"
        )}
        title={t('sidebar.settings')}
    >
        <Settings className="w-4 h-4 shrink-0" />
    </Button>
);

const getIconForId = (id: SettingsCategory) => {
    switch (id) {
        case 'models': return Database;
        case 'appearance': return Image;
        case 'speech': return Mic;
        case 'statistics': return Activity;
        case 'about': return Info;
        case 'developer': return Terminal;
        case 'advanced': return Cpu;
        case 'accounts': return UserCircle;
        case 'usage-limits': return TrendingUp;
        default: return LayoutGrid;
    }
};
