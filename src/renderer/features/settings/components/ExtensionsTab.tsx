import { ExternalLink } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { SettingsSharedProps } from '../types';

import { ExtensionPluginsTab } from './ExtensionPluginsTab';
import { MCPServersTab } from './MCPServersTab';
import { SkillsTab } from './SkillsTab';

export type ExtensionSettingsSection = 'mcp' | 'skills' | 'plugins';

interface ExtensionsTabProps extends SettingsSharedProps {
    initialSection?: ExtensionSettingsSection;
}

export const ExtensionsTab: React.FC<ExtensionsTabProps> = ({
    t,
    initialSection = 'plugins',
}) => {
    const [section, setSection] = useState<ExtensionSettingsSection>(initialSection);

    useEffect(() => {
        setSection(initialSection);
    }, [initialSection]);

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-semibold">{t('settings.tabs.extensions')}</h3>
                    <p className="text-sm text-muted-foreground">{t('settings.extensions.description')}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.open('https://tengra.ai/market', '_blank')}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t('sidebar.marketplace')}
                </Button>
            </div>

            <div className="inline-flex rounded-lg border border-border/40 bg-muted/20 p-1">
                {([
                    ['plugins', t('settings.tabs.plugins')],
                    ['mcp', t('settings.tabs.mcpServers')],
                    ['skills', t('settings.tabs.skills')],
                ] as Array<[ExtensionSettingsSection, string]>).map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setSection(id)}
                        className={cn(
                            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                            section === id
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {section === 'plugins' ? (
                <ExtensionPluginsTab t={t} />
            ) : section === 'mcp' ? (
                <div className="rounded-lg border border-border/40 bg-card/30">
                    <MCPServersTab />
                </div>
            ) : (
                <SkillsTab t={t} />
            )}
        </div>
    );
};

