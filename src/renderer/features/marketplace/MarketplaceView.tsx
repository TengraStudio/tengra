import {
    ChevronRight,
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

type MarketplaceTab = 'mcp' | 'themes' | 'personas' | 'models' | 'prompts';

export const MarketplaceView: React.FC = () => {
    const { language } = useAuthLanguage();
    const { t } = useTranslation(language);
    const [activeTab, setActiveTab] = useState<MarketplaceTab>('mcp');

    const tabs: Array<{ id: MarketplaceTab, icon: React.ElementType }> = [
        { id: 'mcp', icon: Package },
        { id: 'themes', icon: Palette },
        { id: 'personas', icon: Sparkles },
        { id: 'models', icon: Zap },
        { id: 'prompts', icon: MessageSquare },
    ];

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="flex flex-col h-full">
                {/* Header Section */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <Grid3X3 className="w-5 h-5 text-primary" />
                        <div>
                            <h1 className="text-lg font-bold tracking-tight leading-none">
                                {t('marketplace.title')}
                            </h1>
                            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium">
                                {t('marketplace.subtitle')}
                            </p>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <nav className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border/40">
                        {tabs.map((tab) => {
                            const isEnabled = tab.id !== 'models';
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
                                    <span>{t(`marketplace.tabs.${tab.id}`)}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
                    <div className="max-w-6xl mx-auto">
                        {activeTab !== 'models' ? (
                            <McpMarketplace key={activeTab} mode={activeTab} />
                        ) : (
                            <SimplePlaceholder tab={activeTab} />
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

const SimplePlaceholder: React.FC<{ tab: MarketplaceTab }> = ({ tab }) => {
    const { language } = useAuthLanguage();
    const { t } = useTranslation(language);

    return (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border/40 rounded-xl bg-muted/5">
            <Sparkles className="w-10 h-10 text-primary opacity-20 mb-4" />
            <h2 className="text-xl font-bold tracking-tight">
                {t('marketplace.placeholders.soon.title', { tab: tab.toUpperCase() })}
            </h2>
            <p className="text-xs text-muted-foreground mt-2 max-w-sm text-center">
                {t('marketplace.placeholders.soon.description', { tab: tab })}
            </p>
            <button className="mt-6 flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90 transition-opacity">
                {t('marketplace.placeholders.soon.button')}
                <ChevronRight className="w-3 h-3" />
            </button>
        </div>
    );
};

export default MarketplaceView;
