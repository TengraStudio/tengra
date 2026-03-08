import type { FileSearchResult } from '@shared/types/common';
import { Check, FileCode2, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';

interface RenameResult {
    success: boolean;
    applied: boolean;
    symbol: string;
    newSymbol: string;
    totalFiles: number;
    totalOccurrences: number;
    changes: Array<{
        file: string;
        replacements: Array<{ line: number; occurrences: number; before: string; after: string }>;
    }>;
    updatedFiles: string[];
    errors: Array<{ file: string; error: string }>;
}

interface DocumentationResult {
    success: boolean;
    filePath: string;
    format: 'markdown' | 'jsdoc-comments';
    content: string;
    symbolCount: number;
    generatedAt: string;
    error?: string;
}

interface QualityResult {
    rootPath: string;
    filesScanned: number;
    totalLines: number;
    functionSymbols: number;
    classSymbols: number;
    longLineCount: number;
    todoLikeCount: number;
    consoleUsageCount: number;
    averageComplexity: number;
    securityIssueCount: number;
    topSecurityFindings: Array<{ file: string; line: number; rule: string; snippet: string }>;
    highestComplexityFiles: Array<{ file: string; complexity: number }>;
    qualityScore: number;
    generatedAt: string;
}

interface WorkspaceCodeTabProps {
    workspaceRoot: string;
    onOpenFile: (path: string, line?: number) => void;
    t: (key: string) => string;
}

export const WorkspaceCodeTab: React.FC<WorkspaceCodeTabProps> = ({ workspaceRoot, onOpenFile, t }) => {
    const [symbol, setSymbol] = useState('');
    const [filePath, setFilePath] = useState('');
    const [newSymbol, setNewSymbol] = useState('');
    const [maxFiles, setMaxFiles] = useState('300');
    const [docFormat, setDocFormat] = useState<'markdown' | 'jsdoc-comments'>('markdown');
    const [definition, setDefinition] = useState<FileSearchResult | null>(null);
    const [references, setReferences] = useState<FileSearchResult[]>([]);
    const [implementations, setImplementations] = useState<FileSearchResult[]>([]);
    const [relationships, setRelationships] = useState<FileSearchResult[]>([]);
    const [outline, setOutline] = useState<FileSearchResult[]>([]);
    const [renamePreview, setRenamePreview] = useState<RenameResult | null>(null);
    const [renameApply, setRenameApply] = useState<RenameResult | null>(null);
    const [docsPreview, setDocsPreview] = useState<DocumentationResult | null>(null);
    const [quality, setQuality] = useState<QualityResult | null>(null);
    const [navigationHistory, setNavigationHistory] = useState<Array<{ file: string; line?: number }>>([]);
    const [navigationIndex, setNavigationIndex] = useState(-1);
    const [busyKey, setBusyKey] = useState<string>('');
    const [error, setError] = useState<string>('');

    const safeMaxFiles = useMemo(() => {
        const parsed = Number(maxFiles);
        return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.trunc(parsed), 3000) : 300;
    }, [maxFiles]);

    const call = async (key: string, fn: () => Promise<void>) => {
        setBusyKey(key);
        setError('');
        try {
            await fn();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusyKey('');
        }
    };

    const pushNavigation = (file: string, line?: number) => {
        setNavigationHistory(prev => {
            const base = navigationIndex >= 0 ? prev.slice(0, navigationIndex + 1) : prev;
            const next = [...base, { file, line }].slice(-100);
            setNavigationIndex(next.length - 1);
            return next;
        });
        onOpenFile(file, line);
    };

    return (
        <div className="h-full overflow-y-auto p-4 space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="text-sm font-semibold flex items-center gap-2">
                    <Search className="w-4 h-4" /> {t('workspaceDashboard.search') || 'Code Navigation'}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_auto_auto] gap-2">
                    <input
                        className="px-3 py-2 rounded-md bg-muted/20 border border-border/50 text-sm"
                        placeholder={t('placeholder.symbolName')}
                        value={symbol}
                        onChange={e => setSymbol(e.target.value)}
                    />
                    <input
                        className="px-3 py-2 rounded-md bg-muted/20 border border-border/50 text-sm"
                        placeholder={t('placeholder.filePathOutline')}
                        value={filePath}
                        onChange={e => setFilePath(e.target.value)}
                    />
                    <button
                        className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-60"
                        disabled={busyKey !== '' || symbol.trim().length === 0}
                        onClick={() => {
                            void call('definition', async () => {
                                const result = await window.electron.code.findDefinition(workspaceRoot, symbol.trim());
                                setDefinition(result);
                            });
                        }}
                    >
                        Definition
                    </button>
                    <button
                        className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-60"
                        disabled={busyKey !== '' || symbol.trim().length === 0}
                        onClick={() => {
                            void call('references', async () => {
                                const result = await window.electron.code.findReferences(workspaceRoot, symbol.trim());
                                setReferences(result);
                            });
                        }}
                    >
                        References
                    </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                        className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-60"
                        disabled={busyKey !== '' || symbol.trim().length === 0}
                        onClick={() => {
                            void call('implementations', async () => {
                                const result = await window.electron.code.findImplementations(workspaceRoot, symbol.trim());
                                setImplementations(result);
                            });
                        }}
                    >
                        Implementations
                    </button>
                    <button
                        className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-60"
                        disabled={busyKey !== '' || symbol.trim().length === 0}
                        onClick={() => {
                            void call('relationships', async () => {
                                const result = await window.electron.code.getSymbolRelationships(workspaceRoot, symbol.trim(), 200);
                                setRelationships(result);
                            });
                        }}
                    >
                        Relationships
                    </button>
                    <button
                        className="px-3 py-2 rounded-md bg-muted text-muted-foreground text-xs disabled:opacity-60"
                        disabled={busyKey !== '' || filePath.trim().length === 0}
                        onClick={() => {
                            void call('outline', async () => {
                                const result = await window.electron.code.getFileOutline(filePath.trim());
                                setOutline(result);
                            });
                        }}
                    >
                        File Outline
                    </button>
                    <button
                        className="px-3 py-2 rounded-md bg-muted text-muted-foreground text-xs disabled:opacity-60"
                        disabled={navigationIndex <= 0}
                        onClick={() => {
                            const nextIndex = navigationIndex - 1;
                            const target = navigationHistory[nextIndex];
                            if (!target) {
                                return;
                            }
                            setNavigationIndex(nextIndex);
                            onOpenFile(target.file, target.line);
                        }}
                    >
                        Nav Back
                    </button>
                    <button
                        className="px-3 py-2 rounded-md bg-muted text-muted-foreground text-xs disabled:opacity-60"
                        disabled={navigationIndex < 0 || navigationIndex >= navigationHistory.length - 1}
                        onClick={() => {
                            const nextIndex = navigationIndex + 1;
                            const target = navigationHistory[nextIndex];
                            if (!target) {
                                return;
                            }
                            setNavigationIndex(nextIndex);
                            onOpenFile(target.file, target.line);
                        }}
                    >
                        Nav Forward
                    </button>
                </div>
                {definition && (
                    <div className="text-xs rounded-md border border-border/50 p-2 bg-muted/20">
                        Definition: <button className="underline" onClick={() => { pushNavigation(definition.file, definition.line); }}>{definition.file}:{definition.line}</button>
                    </div>
                )}
                {references.length > 0 && (
                    <div className="max-h-36 overflow-y-auto text-xs rounded-md border border-border/50 p-2 bg-muted/20 space-y-1">
                        {references.slice(0, 40).map((item, idx) => (
                            <div key={`${item.file}:${item.line}:${idx}`}>
                                <button className="underline" onClick={() => { pushNavigation(item.file, item.line); }}>
                                    {item.file}:{item.line}
                                </button>{' '}
                                <span className="text-muted-foreground">{item.text}</span>
                            </div>
                        ))}
                    </div>
                )}
                {implementations.length > 0 && (
                    <div className="max-h-36 overflow-y-auto text-xs rounded-md border border-border/50 p-2 bg-muted/20 space-y-1">
                        {implementations.slice(0, 40).map((item, idx) => (
                            <div key={`${item.file}:${item.line}:${idx}:impl`}>
                                <button className="underline" onClick={() => { pushNavigation(item.file, item.line); }}>
                                    {item.file}:{item.line}
                                </button>{' '}
                                <span className="text-muted-foreground">{item.text}</span>
                            </div>
                        ))}
                    </div>
                )}
                {relationships.length > 0 && (
                    <div className="max-h-36 overflow-y-auto text-xs rounded-md border border-border/50 p-2 bg-muted/20 space-y-1">
                        {relationships.slice(0, 80).map((item, idx) => (
                            <div key={`${item.file}:${item.line}:${idx}:rel`}>
                                <button className="underline" onClick={() => { pushNavigation(item.file, item.line); }}>
                                    {item.file}:{item.line}
                                </button>{' '}
                                <span className="text-muted-foreground">[{item.type}] {item.name ?? item.text}</span>
                            </div>
                        ))}
                    </div>
                )}
                {outline.length > 0 && (
                    <div className="max-h-36 overflow-y-auto text-xs rounded-md border border-border/50 p-2 bg-muted/20 space-y-1">
                        {outline.map((item, idx) => (
                            <div key={`${item.file}:${item.line}:${idx}`}>
                                <button className="underline" onClick={() => { pushNavigation(item.file, item.line); }}>
                                    {item.name ?? item.text}
                                </button>{' '}
                                <span className="text-muted-foreground">({item.type}) line {item.line}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="text-sm font-semibold flex items-center gap-2">
                    <FileCode2 className="w-4 h-4" /> Refactor Rename
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_100px_auto_auto] gap-2">
                    <input className="px-3 py-2 rounded-md bg-muted/20 border border-border/50 text-sm" placeholder={t('placeholder.oldSymbol')} value={symbol} onChange={e => setSymbol(e.target.value)} />
                    <input className="px-3 py-2 rounded-md bg-muted/20 border border-border/50 text-sm" placeholder={t('placeholder.newSymbol')} value={newSymbol} onChange={e => setNewSymbol(e.target.value)} />
                    <input className="px-3 py-2 rounded-md bg-muted/20 border border-border/50 text-sm" placeholder={t('placeholder.maxFiles')} value={maxFiles} onChange={e => setMaxFiles(e.target.value)} />
                    <button
                        className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-60"
                        disabled={busyKey !== '' || symbol.trim() === '' || newSymbol.trim() === ''}
                        onClick={() => {
                            void call('rename-preview', async () => {
                                const result = await window.electron.code.previewRenameSymbol(workspaceRoot, symbol.trim(), newSymbol.trim(), safeMaxFiles);
                                setRenamePreview(result as RenameResult);
                            });
                        }}
                    >
                        Preview
                    </button>
                    <button
                        className="px-3 py-2 rounded-md bg-destructive text-destructive-foreground text-xs disabled:opacity-60"
                        disabled={busyKey !== '' || symbol.trim() === '' || newSymbol.trim() === ''}
                        onClick={() => {
                            void call('rename-apply', async () => {
                                const result = await window.electron.code.applyRenameSymbol(workspaceRoot, symbol.trim(), newSymbol.trim(), safeMaxFiles);
                                setRenameApply(result as RenameResult);
                            });
                        }}
                    >
                        Apply
                    </button>
                </div>
                {renamePreview && (
                    <div className="text-xs rounded-md border border-border/50 p-2 bg-muted/20">
                        Preview: {renamePreview.totalOccurrences} occurrence(s) in {renamePreview.totalFiles} file(s)
                    </div>
                )}
                {renameApply && (
                    <div className="text-xs rounded-md border border-border/50 p-2 bg-muted/20 inline-flex items-center gap-2">
                        <Check className="w-3.5 h-3.5" /> Applied: {renameApply.updatedFiles.length} file(s) updated
                    </div>
                )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="text-sm font-semibold">Documentation + Quality</div>
                <div className="grid grid-cols-1 md:grid-cols-[2fr_160px_auto_auto] gap-2">
                    <input className="px-3 py-2 rounded-md bg-muted/20 border border-border/50 text-sm" placeholder={t('placeholder.filePathDocs')} value={filePath} onChange={e => setFilePath(e.target.value)} />
                    <select className="px-3 py-2 rounded-md bg-muted/20 border border-border/50 text-sm" value={docFormat} onChange={e => setDocFormat(e.target.value as 'markdown' | 'jsdoc-comments')}>
                        <option value="markdown">markdown</option>
                        <option value="jsdoc-comments">jsdoc-comments</option>
                    </select>
                    <button
                        className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-60"
                        disabled={busyKey !== '' || filePath.trim() === ''}
                        onClick={() => {
                            void call('docs', async () => {
                                const result = await window.electron.code.generateFileDocumentation(filePath.trim(), docFormat);
                                setDocsPreview(result);
                            });
                        }}
                    >
                        Generate Docs
                    </button>
                    <button
                        className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-60"
                        disabled={busyKey !== ''}
                        onClick={() => {
                            void call('workspace-docs', async () => {
                                const result = await window.electron.code.generateWorkspaceDocumentation(workspaceRoot, safeMaxFiles);
                                setDocsPreview(result);
                            });
                        }}
                    >
                        Workspace Docs
                    </button>
                    <button
                        className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-60"
                        disabled={busyKey !== ''}
                        onClick={() => {
                            void call('quality', async () => {
                                const result = await window.electron.code.analyzeQuality(workspaceRoot, safeMaxFiles);
                                setQuality(result);
                            });
                        }}
                    >
                        Analyze Quality
                    </button>
                </div>
                {docsPreview && (
                    <pre className="text-xs rounded-md border border-border/50 p-2 bg-muted/20 max-h-48 overflow-auto whitespace-pre-wrap">{docsPreview.content || docsPreview.error || 'No output'}</pre>
                )}
                {quality && (
                    <div className="text-xs rounded-md border border-border/50 p-2 bg-muted/20 grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div>Score: <strong>{quality.qualityScore}</strong></div>
                        <div>Files: <strong>{quality.filesScanned}</strong></div>
                        <div>Avg Complexity: <strong>{quality.averageComplexity}</strong></div>
                        <div>Long Lines: <strong>{quality.longLineCount}</strong></div>
                        <div>Security: <strong>{quality.securityIssueCount}</strong></div>
                    </div>
                )}
                {error && (
                    <div className="text-xs text-destructive">{error}</div>
                )}
            </div>
        </div>
    );
};
