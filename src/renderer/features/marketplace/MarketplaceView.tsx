import {
    Globe,
    Grid3X3,
    MessageSquare,
    Package,
    Palette,
    Sparkles,
    Zap,
} from 'lucide-react';
import React, { useState } from 'react';

import { useAuthLanguage } from '@/context/AuthContext';
import { useTranslation } from '@/i18n';

import { McpMarketplace } from './components/McpMarketplace';
import { SkillsMarketplace } from './components/SkillsMarketplace';

type MarketplaceTab = 'mcp' | 'skills' | 'themes' | 'personas' | 'models' | 'prompts' | 'languages';

export function MarketplaceView(): JSX.Element {
    const { language } = useAuthLanguage();
    const { t } = useTranslation(language);
    const [activeTab, setActiveTab] = useState<MarketplaceTab>('mcp');

    const tabs: Array<{ id: MarketplaceTab, icon: React.ElementType }> = [
        { id: 'mcp', icon: Package },
        { id: 'skills', icon: Sparkles },
        { id: 'themes', icon: Palette },
        { id: 'personas', icon: Sparkles },
        { id: 'models', icon: Zap },
        { id: 'prompts', icon: MessageSquare },
        { id: 'languages', icon: Globe },
    ];
    const tabLabels: Record<MarketplaceTab, string> = {
        mcp: t('marketplace.tabs.mcp'),
        skills: t('marketplace.tabs.skills'),
        themes: t('marketplace.tabs.themes'),
        personas: t('marketplace.tabs.personas'),
        models: t('marketplace.tabs.models'),
        prompts: t('marketplace.tabs.prompts'),
        languages: t('marketplace.tabs.languages'),
    };

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="flex flex-col h-full">
                {/* Header Section */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <Grid3X3 className="w-5 h-5 text-primary" />
                        <div>
                            <h1 className="text-lg font-bold leading-none">
                                {t('marketplace.title')}
                            </h1>
                            <p className="text-xs text-muted-foreground mt-1 font-medium">
                                {t('marketplace.subtitle')}
                            </p>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <nav className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border/40">
                        {tabs.map((tab) => {
                            const isEnabled = true;
                            return (
                                <button
                                    key={tab.id}
                                    disabled={!isEnabled}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-background text-foreground shadow-sm'
                                            : isEnabled
                                                ? 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                                : 'text-muted-foreground/30 cursor-not-allowed grayscale pointer-events-none'
                                    }`}
                                >
                                    <tab.icon className="w-3.5 h-3.5" />
                                    <span>{tabLabels[tab.id]}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
                    <div className="max-w-6xl mx-auto">
                        {activeTab === 'skills' ? (
                            <SkillsMarketplace />
                        ) : (
                            <McpMarketplace key={activeTab} mode={activeTab} />
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default MarketplaceView;
