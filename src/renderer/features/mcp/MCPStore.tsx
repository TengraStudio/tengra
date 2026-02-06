/**
 * MCP Tool Store Component
 * Browse, install, and manage Model Context Protocol tools/servers.
 */

import { Check, Code, Database, Download, FileText, Globe, Plug, Search, Server, Settings, Shield, Star, Terminal, Zap } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface MCPTool {
    id: string;
    nameKey: string;
    descriptionKey: string;
    author: string;
    authorKey?: string;
    version: string;
    category: 'filesystem' | 'database' | 'api' | 'development' | 'utility' | 'ai';
    icon: React.ReactNode;
    featureKeys: string[];
    downloads: number;
    rating: number;
    isInstalled?: boolean;
    isOfficial?: boolean;
    configSchema?: Record<string, unknown>;
    repositoryUrl?: string;
}

const MCP_TOOLS: MCPTool[] = [
    { id: 'filesystem', nameKey: 'mcp.tools.filesystem.name', descriptionKey: 'mcp.tools.filesystem.description', author: 'Anthropic', version: '1.0.0', category: 'filesystem', icon: <FileText className="w-5 h-5" />, featureKeys: ['mcp.tools.filesystem.features.read', 'mcp.tools.filesystem.features.write', 'mcp.tools.filesystem.features.list', 'mcp.tools.filesystem.features.search', 'mcp.tools.filesystem.features.watch'], downloads: 50000, rating: 4.9, isInstalled: true, isOfficial: true },
    { id: 'postgres', nameKey: 'mcp.tools.postgres.name', descriptionKey: 'mcp.tools.postgres.description', author: 'Anthropic', version: '1.0.0', category: 'database', icon: <Database className="w-5 h-5" />, featureKeys: ['mcp.tools.postgres.features.sql', 'mcp.tools.postgres.features.schema', 'mcp.tools.postgres.features.export', 'mcp.tools.postgres.features.pooling'], downloads: 35000, rating: 4.8, isInstalled: false, isOfficial: true },
    { id: 'github', nameKey: 'mcp.tools.github.name', descriptionKey: 'mcp.tools.github.description', author: 'Anthropic', version: '1.0.0', category: 'api', icon: <Code className="w-5 h-5" />, featureKeys: ['mcp.tools.github.features.repos', 'mcp.tools.github.features.issues', 'mcp.tools.github.features.reviews', 'mcp.tools.github.features.search'], downloads: 42000, rating: 4.7, isInstalled: true, isOfficial: true },
    { id: 'brave-search', nameKey: 'mcp.tools.braveSearch.name', descriptionKey: 'mcp.tools.braveSearch.description', author: 'Anthropic', version: '1.0.0', category: 'api', icon: <Globe className="w-5 h-5" />, featureKeys: ['mcp.tools.braveSearch.features.web', 'mcp.tools.braveSearch.features.news', 'mcp.tools.braveSearch.features.images', 'mcp.tools.braveSearch.features.safe'], downloads: 28000, rating: 4.6, isInstalled: false, isOfficial: true },
    { id: 'puppeteer', nameKey: 'mcp.tools.puppeteer.name', descriptionKey: 'mcp.tools.puppeteer.description', author: 'Community', authorKey: 'mcp.authors.community', version: '0.8.0', category: 'development', icon: <Terminal className="w-5 h-5" />, featureKeys: ['mcp.tools.puppeteer.features.navigation', 'mcp.tools.puppeteer.features.screenshots', 'mcp.tools.puppeteer.features.pdf', 'mcp.tools.puppeteer.features.forms'], downloads: 22000, rating: 4.5, isInstalled: false, isOfficial: false },
    { id: 'sqlite', nameKey: 'mcp.tools.sqlite.name', descriptionKey: 'mcp.tools.sqlite.description', author: 'Anthropic', version: '1.0.0', category: 'database', icon: <Database className="w-5 h-5" />, featureKeys: ['mcp.tools.sqlite.features.local', 'mcp.tools.sqlite.features.fast', 'mcp.tools.sqlite.features.memory', 'mcp.tools.sqlite.features.fts'], downloads: 31000, rating: 4.8, isInstalled: true, isOfficial: true },
    { id: 'fetch', nameKey: 'mcp.tools.fetch.name', descriptionKey: 'mcp.tools.fetch.description', author: 'Anthropic', version: '1.0.0', category: 'api', icon: <Zap className="w-5 h-5" />, featureKeys: ['mcp.tools.fetch.features.methods', 'mcp.tools.fetch.features.headers', 'mcp.tools.fetch.features.json', 'mcp.tools.fetch.features.forms'], downloads: 45000, rating: 4.9, isInstalled: false, isOfficial: true },
    { id: 'memory', nameKey: 'mcp.tools.memory.name', descriptionKey: 'mcp.tools.memory.description', author: 'Anthropic', version: '1.0.0', category: 'ai', icon: <Server className="w-5 h-5" />, featureKeys: ['mcp.tools.memory.features.kv', 'mcp.tools.memory.features.entities', 'mcp.tools.memory.features.context', 'mcp.tools.memory.features.summarize'], downloads: 38000, rating: 4.7, isInstalled: false, isOfficial: true }
];

const CATEGORIES = [
    { id: 'all', labelKey: 'mcp.categories.all', icon: Plug },
    { id: 'filesystem', labelKey: 'mcp.categories.filesystem', icon: FileText },
    { id: 'database', labelKey: 'mcp.categories.database', icon: Database },
    { id: 'api', labelKey: 'mcp.categories.api', icon: Globe },
    { id: 'development', labelKey: 'mcp.categories.development', icon: Code },
    { id: 'ai', labelKey: 'mcp.categories.ai', icon: Zap }
];

const ToolCard = ({ tool, onSelect, onInstall, onUninstall, onConfigure, t }: { tool: MCPTool, onSelect: (t: MCPTool) => void, onInstall?: (id: string) => void, onUninstall?: (id: string) => void, onConfigure?: (id: string) => void, t: (key: string, options?: Record<string, string | number>) => string }) => (
    <div onClick={() => onSelect(tool)} className={cn("group p-4 rounded-xl border transition-all cursor-pointer", tool.isInstalled ? "border-primary/30 bg-primary/5" : "border-border/30 hover:border-border/60 bg-card/30")}>
        <div className="flex items-start gap-3"><div className={cn("p-2.5 rounded-lg", tool.isInstalled ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground")}>{tool.icon}</div><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1"><h3 className="font-semibold text-sm truncate">{t(tool.nameKey)}</h3>{tool.isOfficial && <Shield className="w-3.5 h-3.5 text-primary" />}{tool.isInstalled && <Check className="w-3.5 h-3.5 text-primary" />}</div><p className="text-xs text-muted-foreground line-clamp-2 mb-2">{t(tool.descriptionKey)}</p><div className="flex items-center gap-3 text-xxs text-muted-foreground/60"><span className="flex items-center gap-1"><Star className="w-3 h-3 text-warning fill-amber-500" />{t('mcp.rating', { rating: tool.rating })}</span><span className="flex items-center gap-1"><Download className="w-3 h-3" />{t('mcp.downloads', { count: tool.downloads.toLocaleString() })}</span><span>{t('mcp.version', { version: tool.version })}</span></div></div></div>
        <div className="flex gap-2 mt-3 pt-3 border-t border-border/20">{tool.isInstalled ? <><button onClick={e => { e.stopPropagation(); onConfigure?.(tool.id); }} className="flex-1 py-1.5 text-xs font-medium bg-muted/50 hover:bg-muted text-foreground rounded-md transition-colors flex items-center justify-center gap-1"><Settings className="w-3 h-3" /> {t('mcp.configure')}</button><button onClick={e => { e.stopPropagation(); onUninstall?.(tool.id); }} className="px-3 py-1.5 text-xs font-medium bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-md transition-colors">{t('mcp.remove')}</button></> : <button onClick={e => { e.stopPropagation(); onInstall?.(tool.id); }} className="flex-1 py-1.5 text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors flex items-center justify-center gap-1"><Download className="w-4 h-4" /> {t('mcp.install')}</button>}</div>
    </div>
);

const ToolDetailModal = ({ tool, onInstall, onUninstall, onConfigure, onClose, t }: { tool: MCPTool, onInstall?: (id: string) => void, onUninstall?: (id: string) => void, onConfigure?: (id: string) => void, onClose: () => void, t: (key: string, options?: Record<string, string | number>) => string }) => (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
        <div onClick={e => e.stopPropagation()} className="bg-card rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-border/30 flex items-center gap-3"><div className="p-3 rounded-lg bg-primary/10 text-primary">{tool.icon}</div><div className="flex-1"><div className="flex items-center gap-2"><h2 className="text-xl font-bold">{t(tool.nameKey)}</h2>{tool.isOfficial && <span className="px-2 py-0.5 bg-primary/10 text-primary text-xxs font-bold rounded-full">{t('mcp.official')}</span>}</div><p className="text-xs text-muted-foreground">{t('mcp.byAuthor', { author: tool.authorKey ? t(tool.authorKey) : tool.author, version: tool.version })}</p></div></div>
            <div className="p-4"><p className="text-sm mb-4">{t(tool.descriptionKey)}</p><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('mcp.features')}</h3><div className="flex flex-wrap gap-2 mb-4">{tool.featureKeys.map((f, i) => <span key={i} className="px-2 py-1 bg-muted/50 text-xs rounded-md">{t(f)}</span>)}</div><div className="flex items-center gap-4 text-sm text-muted-foreground mb-4"><span className="flex items-center gap-1"><Star className="w-4 h-4 text-warning fill-amber-500" />{t('mcp.rating', { rating: tool.rating })}</span><span className="flex items-center gap-1"><Download className="w-4 h-4" />{t('mcp.downloads', { count: tool.downloads.toLocaleString() })}</span></div>
                <div className="flex gap-2">{tool.isInstalled ? <><button onClick={() => { onConfigure?.(tool.id); onClose(); }} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2"><Settings className="w-4 h-4" /> {t('mcp.configure')}</button><button onClick={() => { onUninstall?.(tool.id); onClose(); }} className="px-4 py-2 bg-destructive/10 text-destructive rounded-lg font-medium text-sm hover:bg-destructive/20">{t('mcp.uninstall')}</button></> : <button onClick={() => { onInstall?.(tool.id); onClose(); }} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2"><Download className="w-4 h-4" /> {t('mcp.installTool')}</button>}<button onClick={onClose} className="px-4 py-2 bg-muted text-muted-foreground rounded-lg font-medium text-sm hover:bg-muted/80">{t('common.close')}</button></div>
            </div>
        </div>
    </div>
);

export const MCPStore: React.FC<{ onInstall?: (id: string) => void, onUninstall?: (id: string) => void, onConfigure?: (id: string) => void }> = ({ onInstall, onUninstall, onConfigure }) => {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);

    const filteredTools = useMemo(() => MCP_TOOLS.filter(tool => {
        const q = searchQuery.toLowerCase();
        const name = t(tool.nameKey);
        const description = t(tool.descriptionKey);
        const featureTexts = tool.featureKeys.map(key => t(key));
        const matchesQuery = !searchQuery || name.toLowerCase().includes(q) || description.toLowerCase().includes(q) || featureTexts.some(f => f.toLowerCase().includes(q));
        const matchesCat = selectedCategory === 'all' || tool.category === selectedCategory;
        return matchesQuery && matchesCat;
    }), [searchQuery, selectedCategory, t]);

    const installedCount = useMemo(() => MCP_TOOLS.filter(t => t.isInstalled).length, []);

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border/30">
                <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-lg bg-primary/10"><Plug className="w-6 h-6 text-primary" /></div><div><h1 className="text-lg font-bold">{t('mcp.storeTitle')}</h1><p className="text-xs text-muted-foreground">{t('mcp.storeSubtitle', { count: installedCount })}</p></div></div>
                <div className="relative mb-3"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" /><input type="text" placeholder={t('mcp.searchTools')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-muted/30 border border-border/30 rounded-lg pl-9 pr-3 py-2 text-sm outline-none" /></div>
                <div className="flex gap-2 overflow-x-auto pb-1">{CATEGORIES.map(({ id, labelKey, icon: Icon }) => <button key={id} onClick={() => setSelectedCategory(id)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors", selectedCategory === id ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50")}><Icon className="w-3.5 h-3.5" />{t(labelKey)}</button>)}</div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{filteredTools.map(tl => <ToolCard key={tl.id} tool={tl} onSelect={setSelectedTool} onInstall={onInstall} onUninstall={onUninstall} onConfigure={onConfigure} t={t} />)}</div>
                {filteredTools.length === 0 && <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50"><Plug className="w-12 h-12 mb-3 opacity-30" /><p className="text-sm">{t('mcp.noToolsFound')}</p></div>}
            </div>
            {selectedTool && <ToolDetailModal tool={selectedTool} onInstall={onInstall} onUninstall={onUninstall} onConfigure={onConfigure} onClose={() => setSelectedTool(null)} t={t} />}
        </div>
    );
};

export default MCPStore;
