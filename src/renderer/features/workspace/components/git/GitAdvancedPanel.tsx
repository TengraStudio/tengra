import { useTranslation } from '@renderer/i18n';
import {
    Check,
    GitBranch,
    GitCompareArrows,
    GitMerge,
    GitPullRequest,
    Hammer,
    Package,
    Play,
    RefreshCw,
    Save,
    Search,
    ShieldCheck,
    Workflow,
    Wrench,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

import { useGitAdvanced } from '../../hooks/useGitAdvanced';

interface GitAdvancedPanelProps {
    projectPath: string;
}

const Card: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }> = ({
    title,
    icon,
    children,
    className,
}) => (
    <section className={cn('bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-5 space-y-3', className)}>
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            {icon}
            {title}
        </div>
        {children}
    </section>
);

const Field: React.FC<{
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    className?: string;
}> = ({ value, onChange, placeholder, className }) => (
    <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn('h-9 rounded-lg border border-border/50 bg-muted/20 px-3 text-sm outline-none focus:border-primary/50', className)}
    />
);

export const GitAdvancedPanel: React.FC<GitAdvancedPanelProps> = ({ projectPath }) => {
    const { t } = useTranslation();
    const git = useGitAdvanced(projectPath);

    const [stashMessage, setStashMessage] = useState('WIP snapshot');
    const [stashQuery, setStashQuery] = useState('');
    const [blameFilePath, setBlameFilePath] = useState('');
    const [rebaseBaseBranch, setRebaseBaseBranch] = useState('develop');
    const [submoduleUrl, setSubmoduleUrl] = useState('');
    const [submodulePath, setSubmodulePath] = useState('');
    const [submoduleBranch, setSubmoduleBranch] = useState('');
    const [flowType, setFlowType] = useState<'feature' | 'release' | 'hotfix' | 'support'>('feature');
    const [flowName, setFlowName] = useState('');
    const [flowBase, setFlowBase] = useState('develop');
    const [finishBranch, setFinishBranch] = useState('');
    const [finishTarget, setFinishTarget] = useState('develop');
    const [hookName, setHookName] = useState('pre-commit');
    const [hookTemplate, setHookTemplate] = useState('');
    const [statsDays, setStatsDays] = useState('365');
    const [operationTimeoutMs, setOperationTimeoutMs] = useState(String(git.operationTimeoutMs ?? 60000));

    useEffect(() => {
        void git.refreshAll();
    }, [git]);

    const filteredStashes = useMemo(() => {
        const query = stashQuery.trim().toLowerCase();
        if (!query) {
            return git.stashes;
        }
        return git.stashes.filter(stash =>
            `${stash.ref} ${stash.subject} ${stash.author}`.toLowerCase().includes(query)
        );
    }, [git.stashes, stashQuery]);

    const topFiles = useMemo(() => git.stats?.fileStats.slice(0, 8) ?? [], [git.stats]);
    const topAuthors = useMemo(() => git.stats?.authorStats.slice(0, 8) ?? [], [git.stats]);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Card title="GIT-00 Operation Controls" icon={<RefreshCw className="w-4 h-4 text-primary" />} className="xl:col-span-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Field value={operationTimeoutMs} onChange={setOperationTimeoutMs} placeholder={t('placeholder.timeoutMs')} className="w-36" />
                    <button
                        onClick={() => git.setOperationTimeoutMs(Math.max(1000, Number.parseInt(operationTimeoutMs, 10) || 60000))}
                        className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40"
                    >
                        Apply timeout
                    </button>
                    <button
                        onClick={() => void git.cancelActiveOperation()}
                        disabled={!git.activeOperationId}
                        className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 disabled:opacity-50"
                    >
                        Cancel active
                    </button>
                    <span className="text-muted-foreground">
                        {git.activeOperationId ? `Running: ${git.activeOperationId}` : 'No active operation'}
                    </span>
                </div>
                {git.lastOperationError && (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                        {git.lastOperationError}
                    </div>
                )}
            </Card>
            <Card
                title="GIT-01 Conflict Resolution"
                icon={<GitMerge className="w-4 h-4 text-warning" />}
            >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Conflicts: {git.conflicts.length}</span>
                    <button
                        onClick={() => void git.fetchConflicts()}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                </div>
                {git.conflicts.length === 0 ? (
                    <div className="text-xs text-muted-foreground rounded-lg border border-border/40 bg-muted/20 p-3">
                        No unresolved conflicts found.
                    </div>
                ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {git.conflicts.map(conflict => (
                            <div key={conflict.path} className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="font-mono text-foreground truncate">{conflict.path}</div>
                                    <span className="text-warning font-semibold">{conflict.status}</span>
                                </div>
                                <div className="text-muted-foreground">{conflict.explanation}</div>
                                <div className="flex flex-wrap gap-1.5">
                                    <button onClick={() => void git.resolveConflict(conflict.path, 'ours')} className="px-2 py-1 rounded border border-border/40 hover:bg-muted/40">{t('git.useOurs')}</button>
                                    <button onClick={() => void git.resolveConflict(conflict.path, 'theirs')} className="px-2 py-1 rounded border border-border/40 hover:bg-muted/40">{t('git.useTheirs')}</button>
                                    <button onClick={() => void git.resolveConflict(conflict.path, 'manual')} className="px-2 py-1 rounded border border-border/40 hover:bg-muted/40">{t('git.markResolved')}</button>
                                    <button onClick={() => void git.openMergeTool(conflict.path)} className="px-2 py-1 rounded border border-border/40 hover:bg-muted/40">{t('git.mergeTool')}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex items-center justify-between text-xs">
                    <div className="text-muted-foreground">
                        {Object.entries(git.conflictAnalytics).map(([status, count]) => `${status}:${count}`).join(' · ') || 'No analytics yet'}
                    </div>
                    <button
                        onClick={git.exportConflictReport}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border/40 hover:bg-muted/40"
                    >
                        <Save className="w-3.5 h-3.5" /> Export
                    </button>
                </div>
            </Card>

            <Card title="GIT-02 Stash Management" icon={<GitCompareArrows className="w-4 h-4 text-primary" />}>
                <div className="flex gap-2">
                    <Field value={stashMessage} onChange={setStashMessage} placeholder={t('placeholder.stashMessage')} className="flex-1" />
                    <button
                        onClick={() => void git.createStash(stashMessage, true)}
                        className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs"
                    >
                        Create
                    </button>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Field value={stashQuery} onChange={setStashQuery} placeholder={t('placeholder.searchStashes')} className="pl-8 w-full" />
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {filteredStashes.map(stash => (
                        <div key={stash.ref} className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs space-y-2">
                            <div className="font-semibold text-foreground">{stash.ref}</div>
                            <div className="text-muted-foreground">{stash.subject}</div>
                            <div className="text-muted-foreground/70">{stash.author} · {stash.date ? new Date(stash.date).toLocaleString() : 'Unknown date'}</div>
                            <div className="flex flex-wrap gap-1.5">
                                <button onClick={() => void git.applyStash(stash.ref, false)} className="px-2 py-1 rounded border border-border/40 hover:bg-muted/40">Apply</button>
                                <button onClick={() => void git.applyStash(stash.ref, true)} className="px-2 py-1 rounded border border-border/40 hover:bg-muted/40">Pop</button>
                                <button onClick={() => void git.dropStash(stash.ref)} className="px-2 py-1 rounded border border-border/40 hover:bg-muted/40">Drop</button>
                                <button onClick={() => void git.exportStash(stash.ref)} className="px-2 py-1 rounded border border-border/40 hover:bg-muted/40">Export Patch</button>
                            </div>
                        </div>
                    ))}
                    {filteredStashes.length === 0 && (
                        <div className="text-xs text-muted-foreground rounded-lg border border-border/40 bg-muted/20 p-3">No stashes found.</div>
                    )}
                </div>
            </Card>

            <Card title="GIT-03 Blame Integration" icon={<GitPullRequest className="w-4 h-4 text-info" />}>
                <div className="flex gap-2">
                    <Field value={blameFilePath} onChange={setBlameFilePath} placeholder={t('placeholder.relativeFilePath')} className="flex-1" />
                    <button onClick={() => void git.loadBlame(blameFilePath)} className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs">Load</button>
                </div>
                <div className="max-h-64 overflow-y-auto border border-border/40 rounded-lg">
                    {git.blameLines.length === 0 ? (
                        <div className="p-3 text-xs text-muted-foreground">No blame data loaded.</div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead className="bg-muted/20 sticky top-0">
                                <tr className="text-left text-muted-foreground">
                                    <th className="px-2 py-1">Line</th>
                                    <th className="px-2 py-1">Commit</th>
                                    <th className="px-2 py-1">Author</th>
                                    <th className="px-2 py-1">Content</th>
                                </tr>
                            </thead>
                            <tbody>
                                {git.blameLines.map(line => (
                                    <tr
                                        key={`${line.lineNumber}-${line.commit}-${line.content}`}
                                        className="border-t border-border/30 hover:bg-muted/20 cursor-pointer"
                                        title={`${line.summary} (${line.authorTime})`}
                                        onMouseEnter={() => void git.loadCommitDetails(line.commit)}
                                    >
                                        <td className="px-2 py-1 text-muted-foreground">{line.lineNumber}</td>
                                        <td className="px-2 py-1 font-mono text-primary/80">{line.commit.slice(0, 8)}</td>
                                        <td className="px-2 py-1 text-muted-foreground">{line.author}</td>
                                        <td className="px-2 py-1 font-mono text-foreground truncate max-w-[240px]">{line.content}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                {git.commitDetails && (
                    <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs space-y-1">
                        <div className="font-semibold text-foreground">{git.commitDetails.subject}</div>
                        <div className="text-muted-foreground">{git.commitDetails.author} · {git.commitDetails.date ? new Date(git.commitDetails.date).toLocaleString() : 'Unknown'}</div>
                        <div className="text-muted-foreground/80 line-clamp-2">{git.commitDetails.body || 'No body'}</div>
                    </div>
                )}
            </Card>

            <Card title="GIT-04 Rebase Support" icon={<Workflow className="w-4 h-4 text-warning" />}>
                <div className="flex gap-2 flex-wrap">
                    <Field value={rebaseBaseBranch} onChange={setRebaseBaseBranch} placeholder={t('placeholder.baseBranch')} className="w-40" />
                    <button onClick={() => void git.fetchRebasePlan(rebaseBaseBranch)} className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs">Preview Plan</button>
                    <button onClick={() => void git.runRebaseAction('start', rebaseBaseBranch)} className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs">Start Rebase</button>
                    <button onClick={() => void git.runRebaseAction('continue')} className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs">Continue</button>
                    <button onClick={() => void git.runRebaseAction('abort')} className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs">Abort</button>
                </div>
                <div className="text-xs text-muted-foreground">
                    In rebase: <span className="text-foreground">{git.rebaseStatus.inRebase ? 'Yes' : 'No'}</span> · Branch: <span className="text-foreground">{git.rebaseStatus.currentBranch ?? 'N/A'}</span> · Conflicts: <span className="text-foreground">{git.rebaseStatus.conflictCount}</span>
                </div>
                <div className="max-h-52 overflow-y-auto rounded-lg border border-border/40 bg-muted/20 p-2 text-xs space-y-1">
                    {git.rebasePlan.length === 0 ? (
                        <div className="text-muted-foreground p-1">No rebase plan loaded.</div>
                    ) : (
                        git.rebasePlan.map(commit => (
                            <div key={commit.hash} className="flex items-center gap-2 border-b border-border/20 pb-1 last:border-0">
                                <span className="font-mono text-primary/80">{commit.hash.slice(0, 8)}</span>
                                <span className="text-foreground truncate">{commit.subject}</span>
                            </div>
                        ))
                    )}
                </div>
            </Card>

            <Card title="GIT-05 Submodule Support" icon={<Package className="w-4 h-4 text-purple" />}>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => void git.runSubmoduleAction('init', { recursive: true })} className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs">Init</button>
                    <button onClick={() => void git.runSubmoduleAction('update', { remote: false })} className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs">Update</button>
                    <button onClick={() => void git.runSubmoduleAction('update', { remote: true })} className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs">Update Remote</button>
                    <button onClick={() => void git.runSubmoduleAction('sync')} className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs">Sync</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_auto] gap-2">
                    <Field value={submoduleUrl} onChange={setSubmoduleUrl} placeholder={t('placeholder.submoduleUrl')} />
                    <Field value={submodulePath} onChange={setSubmodulePath} placeholder={t('placeholder.submodulePath')} />
                    <Field value={submoduleBranch} onChange={setSubmoduleBranch} placeholder={t('placeholder.branchOptional')} />
                    <button
                        onClick={() => void git.runSubmoduleAction('add', { url: submoduleUrl, path: submodulePath, branch: submoduleBranch })}
                        className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs"
                    >
                        Add
                    </button>
                </div>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {git.submodules.map(item => (
                        <div key={item.path} className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-foreground">{item.path}</span>
                                <span className="text-muted-foreground">{item.state}</span>
                            </div>
                            <div className="text-muted-foreground truncate">{item.url || 'No URL'}</div>
                            <div className="text-muted-foreground/80">{item.hash?.slice(0, 8)} {item.branch ? `· ${item.branch}` : ''}</div>
                            <button onClick={() => void git.runSubmoduleAction('remove', { path: item.path })} className="px-2 py-1 rounded border border-border/40 hover:bg-muted/40">Remove</button>
                        </div>
                    ))}
                    {git.submodules.length === 0 && (
                        <div className="text-xs text-muted-foreground rounded-lg border border-border/40 bg-muted/20 p-3">No submodules found.</div>
                    )}
                </div>
            </Card>

            <Card title="GIT-06 Git Flow" icon={<GitBranch className="w-4 h-4 text-success" />}>
                <div className="text-xs text-muted-foreground">
                    Current branch: <span className="text-foreground font-mono">{git.flowStatus.currentBranch || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr_auto] gap-2">
                    <select
                        value={flowType}
                        onChange={e => setFlowType(e.target.value as 'feature' | 'release' | 'hotfix' | 'support')}
                        className="h-9 rounded-lg border border-border/50 bg-muted/20 px-3 text-sm outline-none focus:border-primary/50"
                    >
                        <option value="feature">feature</option>
                        <option value="release">release</option>
                        <option value="hotfix">hotfix</option>
                        <option value="support">support</option>
                    </select>
                    <Field value={flowName} onChange={setFlowName} placeholder={t('placeholder.branchName')} />
                    <Field value={flowBase} onChange={setFlowBase} placeholder={t('placeholder.base')} />
                    <button onClick={() => void git.startFlowBranch(flowType, flowName, flowBase)} className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs">Start</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_auto] gap-2">
                    <Field value={finishBranch} onChange={setFinishBranch} placeholder={t('placeholder.branchToFinish')} />
                    <Field value={finishTarget} onChange={setFinishTarget} placeholder={t('placeholder.targetBranch')} />
                    <button onClick={() => void git.finishFlowBranch(finishBranch, finishTarget, true)} className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs">Finish</button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-border/40 bg-muted/20 p-2">
                        <div className="font-semibold text-muted-foreground mb-1">Feature</div>
                        <div className="text-foreground/90">{git.flowStatus.byType.feature.join(', ') || '—'}</div>
                    </div>
                    <div className="rounded-lg border border-border/40 bg-muted/20 p-2">
                        <div className="font-semibold text-muted-foreground mb-1">Release/Hotfix</div>
                        <div className="text-foreground/90">{[...git.flowStatus.byType.release, ...git.flowStatus.byType.hotfix].join(', ') || '—'}</div>
                    </div>
                </div>
            </Card>

            <Card title="GIT-07 Hooks Management" icon={<Hammer className="w-4 h-4 text-info" />}>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2">
                    <select
                        value={hookName}
                        onChange={e => setHookName(e.target.value)}
                        className="h-9 rounded-lg border border-border/50 bg-muted/20 px-3 text-sm outline-none focus:border-primary/50"
                    >
                        {git.hookTemplates.map(template => (
                            <option key={template} value={template}>{template}</option>
                        ))}
                        {git.hookTemplates.length === 0 && <option value="pre-commit">pre-commit</option>}
                    </select>
                    <Field value={hookTemplate} onChange={setHookTemplate} placeholder={t('placeholder.customHookScript')} />
                    <button onClick={() => void git.installHook(hookName, hookTemplate)} className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs">Install</button>
                </div>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {git.hooks.map(hook => (
                        <div key={hook.name} className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-foreground">{hook.name}</span>
                                <span className="text-muted-foreground">{new Date(hook.updatedAt).toLocaleDateString()}</span>
                            </div>
                            <div className="text-muted-foreground truncate">{hook.path}</div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <span>Exec: {hook.executable ? 'yes' : 'no'}</span>
                                <span>Shebang: {hook.hasShebang ? 'yes' : 'no'}</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => void git.validateHook(hook.name)} className="px-2 py-1 rounded border border-border/40 hover:bg-muted/40 inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Validate</button>
                                <button onClick={() => void git.testHook(hook.name)} className="px-2 py-1 rounded border border-border/40 hover:bg-muted/40 inline-flex items-center gap-1"><Play className="w-3.5 h-3.5" /> Test</button>
                            </div>
                        </div>
                    ))}
                    {git.hooks.length === 0 && (
                        <div className="text-xs text-muted-foreground rounded-lg border border-border/40 bg-muted/20 p-3">No hooks installed.</div>
                    )}
                </div>
                {git.hookValidation && (
                    <div className="rounded-lg border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground inline-flex items-center gap-2">
                        <Check className={cn('w-3.5 h-3.5', git.hookValidation.valid ? 'text-success' : 'text-destructive')} />
                        {git.hookValidation.hookName}: {git.hookValidation.valid ? 'valid' : 'invalid'}
                    </div>
                )}
                {git.hookTestOutput && (
                    <div className="rounded-lg border border-border/40 bg-muted/20 p-2 text-xs font-mono whitespace-pre-wrap max-h-28 overflow-y-auto">
                        {git.hookTestOutput.stdout || git.hookTestOutput.stderr || 'No hook output.'}
                    </div>
                )}
                <button onClick={() => void git.exportHooks()} className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs inline-flex items-center gap-1">
                    <Wrench className="w-3.5 h-3.5" /> Export Hooks
                </button>
            </Card>

            <Card title="GIT-08 Repository Statistics" icon={<GitCompareArrows className="w-4 h-4 text-primary" />} className="xl:col-span-2">
                <div className="flex flex-wrap items-center gap-2">
                    <Field value={statsDays} onChange={setStatsDays} placeholder={t('placeholder.days')} className="w-28" />
                    <button onClick={() => void git.fetchStats(Number(statsDays) || 365)} className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs">Refresh Stats</button>
                    <button onClick={() => void git.exportStats(Number(statsDays) || 365)} className="px-3 h-9 rounded-lg border border-border/40 hover:bg-muted/40 text-xs">Export CSV</button>
                </div>
                {git.stats ? (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                                <div className="text-muted-foreground">Total commits</div>
                                <div className="text-xl font-semibold text-foreground">{git.stats.totalCommits}</div>
                            </div>
                            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                                <div className="text-muted-foreground">Authors</div>
                                <div className="text-xl font-semibold text-foreground">{git.stats.authorStats.length}</div>
                            </div>
                            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                                <div className="text-muted-foreground">Tracked files (top list)</div>
                                <div className="text-xl font-semibold text-foreground">{git.stats.fileStats.length}</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-1">
                                <div className="font-semibold text-muted-foreground">Top Authors</div>
                                {topAuthors.map(item => (
                                    <div key={item.author} className="flex justify-between gap-3">
                                        <span className="truncate text-foreground">{item.author}</span>
                                        <span className="text-muted-foreground">{item.commits}</span>
                                    </div>
                                ))}
                                {topAuthors.length === 0 && <div className="text-muted-foreground">No data</div>}
                            </div>
                            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-1">
                                <div className="font-semibold text-muted-foreground">Top Files</div>
                                {topFiles.map(item => (
                                    <div key={item.file} className="flex justify-between gap-3">
                                        <span className="truncate text-foreground font-mono">{item.file}</span>
                                        <span className="text-muted-foreground">{item.commits}</span>
                                    </div>
                                ))}
                                {topFiles.length === 0 && <div className="text-muted-foreground">No data</div>}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-xs text-muted-foreground rounded-lg border border-border/40 bg-muted/20 p-3">Statistics not loaded.</div>
                )}
            </Card>

            {git.isLoading && (
                <div className="xl:col-span-2 text-xs text-muted-foreground inline-flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Refreshing advanced Git data...
                </div>
            )}
        </div>
    );
};
