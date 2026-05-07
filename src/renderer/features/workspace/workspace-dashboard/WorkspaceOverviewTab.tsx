import { IconBrandTypescript, IconFiles, IconFolder, IconStack } from '@tabler/icons-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import React from 'react';

import { WorkspaceDashboardHeader } from '@/features/workspace/components/WorkspaceDashboardHeader';
import { WorkspaceStatsCards } from '@/features/workspace/components/WorkspaceStatsCards';
import type { Workspace, WorkspaceAnalysis, WorkspaceStats } from '@/types';

interface WorkspaceOverviewTabProps {
    workspace: Workspace;
    workspaceRoot: string;
    analysis: WorkspaceAnalysis | null;
    stats: WorkspaceStats | null;
    isEditingName: boolean;
    setIsEditingName: (v: boolean) => void;
    editName: string;
    setEditName: (v: string) => void;
    handleSaveName: () => Promise<void>;
    isEditingDesc: boolean;
    setIsEditingDesc: (v: boolean) => void;
    editDesc: string;
    setEditDesc: (v: string) => void;
    handleSaveDesc: () => Promise<void>;
    onUploadLogo?: () => void;
    t: (key: string, options?: Record<string, unknown>) => string;
}

function DetailItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-2 text-sm text-foreground break-all">{value}</div>
        </div>
    );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className="text-muted-foreground">{icon}</div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
    );
}

function normalizeTechVersion(version: string | undefined): string {
    if (!version || version === '*' || version.trim().length === 0) {
        return 'detected';
    }
    return version;
}

function LanguageTooltip({
    active,
    payload,
}: {
    active?: boolean;
    payload?: Array<{ payload?: { name?: string; lines?: number; color?: string } }>;
}) {
    if (!active || !payload?.length) {
        return null;
    }

    const item = payload[0]?.payload;
    if (!item?.name || typeof item.lines !== 'number') {
        return null;
    }

    return (
        <div className="rounded-xl border border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
            <div className="flex items-center gap-2">
                <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color ?? LANGUAGE_COLORS[0] }}
                />
                <div className="text-sm font-medium text-foreground">{item.name}</div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
                {item.lines.toLocaleString()} lines
            </div>
        </div>
    );
}

function DirectoryTooltip({
    active,
    payload,
}: {
    active?: boolean;
    payload?: Array<{ payload?: { path?: string; fileCount?: number; sizeLabel?: string; color?: string } }>;
}) {
    if (!active || !payload?.length) {
        return null;
    }

    const item = payload[0]?.payload;
    if (!item?.path || typeof item.fileCount !== 'number' || !item.sizeLabel) {
        return null;
    }

    return (
        <div className="rounded-xl border border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
            <div className="flex items-center gap-2">
                <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color ?? LANGUAGE_COLORS[0] }}
                />
                <div className="max-w-[260px] truncate text-sm font-medium text-foreground">{item.path}</div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
                {item.fileCount.toLocaleString()} files
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
                {item.sizeLabel}
            </div>
        </div>
    );
}

function useElementWidth() {
    const [element, setElement] = React.useState<HTMLDivElement | null>(null);
    const [width, setWidth] = React.useState(0);

    React.useEffect(() => {
        if (!element) {
            return;
        }

        const updateWidth = () => {
            setWidth(element.getBoundingClientRect().width);
        };

        updateWidth();

        const observer = new ResizeObserver(() => {
            updateWidth();
        });
        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, [element]);

    return [setElement, width] as const;
}

const LANGUAGE_COLORS = [
    '#38bdf8',
    '#34d399',
    '#f59e0b',
    '#a78bfa',
    '#fb7185',
    '#f97316',
];

export const WorkspaceOverviewTab = ({
    workspace,
    workspaceRoot,
    analysis,
    stats,
    isEditingName,
    setIsEditingName,
    editName,
    setEditName,
    handleSaveName,
    isEditingDesc,
    setIsEditingDesc,
    editDesc,
    setEditDesc,
    handleSaveDesc,
    onUploadLogo,
    t,
}: WorkspaceOverviewTabProps) => {
    const [setDirectoryChartElement, directoryChartWidth] = useElementWidth();
    const [setLanguageChartElement, languageChartWidth] = useElementWidth();

    if (!analysis) {
        return null;
    }

    const formatBytes = (bytes: number) => {
        if (bytes === 0) { return '0 B'; }
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    };

    const moduleCount = analysis.monorepo?.packages.length ?? Object.keys(analysis.dependencies).length;
    const totalLanguageWeight = Object.values(analysis.languages).reduce(
        (sum, value) => sum + (typeof value === 'number' ? value : 0),
        0
    );
    const topLanguages = Object.entries(analysis.languages)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 10);
    const languageChartEntries = Object.entries(analysis.languages)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 10);
    const languageChartData = languageChartEntries.map(([name, lines], index) => ({
        name,
        lines: lines as number,
        color: LANGUAGE_COLORS[index % LANGUAGE_COLORS.length],
    }));
    const primaryLanguage = languageChartData[0]?.name ?? t('frontend.workspaceDashboard.noResults');
    const largestDirectories = stats?.largestDirectories ?? [];
    const topDirectories = largestDirectories.slice(0, 8);
    const totalDirectorySize = topDirectories.reduce((sum, dir) => sum + dir.size, 0);
    const directoryChartData = topDirectories.map((dir, index) => ({
        path: dir.path,
        fileCount: dir.fileCount,
        size: dir.size,
        sizeLabel: formatBytes(dir.size),
        percent: totalDirectorySize > 0 ? (dir.size / totalDirectorySize) * 100 : 0,
        color: LANGUAGE_COLORS[index % LANGUAGE_COLORS.length],
    }));
    const topFilesByLoc = stats?.topFilesByLoc ?? [];
    const technologyEntries = [
        { name: analysis.type, version: 'detected', source: t('frontend.workspaceDashboard.fileType') },
        ...(analysis.monorepo ? [{ name: analysis.monorepo.type, version: analysis.monorepo.packages.length > 0 ? `${analysis.monorepo.packages.length} packages` : 'detected', source: t('frontend.workspaceDashboard.rootPath') }] : []),
        ...analysis.frameworks.map(name => ({ name, version: 'detected', source: t('frontend.workspaceDashboard.techStack') })),
        ...Object.entries(analysis.dependencies).map(([name, version]) => ({ name, version: normalizeTechVersion(version), source: t('frontend.workspaceDashboard.dependencies') })),
        ...Object.entries(analysis.devDependencies).map(([name, version]) => ({ name, version: normalizeTechVersion(version), source: t('frontend.workspaceDashboard.devDependencies') })),
    ].filter((entry, index, all) => all.findIndex(item => item.name.toLowerCase() === entry.name.toLowerCase()) === index);
    const chartsReady = directoryChartWidth > 0 && languageChartWidth > 0;

    return (
        <div className="space-y-6 overflow-y-auto pr-2 pb-12">
            <WorkspaceDashboardHeader
                workspace={workspace}
                workspaceRoot={workspaceRoot}
                type={analysis.type}
                isEditingName={isEditingName}
                setIsEditingName={setIsEditingName}
                editName={editName}
                setEditName={setEditName}
                handleSaveName={handleSaveName}
                isEditingDesc={isEditingDesc}
                setIsEditingDesc={setIsEditingDesc}
                editDesc={editDesc}
                setEditDesc={setEditDesc}
                handleSaveDesc={handleSaveDesc}
                onUploadLogo={onUploadLogo}
            />

            <WorkspaceStatsCards stats={stats} moduleCount={moduleCount} />

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="min-w-0 rounded-2xl border border-border bg-card p-5 space-y-4">
                    <SectionHeader
                        icon={<IconFolder className="h-4 w-4" />}
                        title={t('frontend.workspaceDashboard.storageBreakdown')}
                    />
                    <div className="space-y-4">
                        <div ref={setDirectoryChartElement} className="h-[260px] min-w-0 rounded-2xl border border-border bg-background p-3">
                            {directoryChartData.length > 0 && chartsReady ? (
                                <BarChart
                                    width={directoryChartWidth}
                                    height={236}
                                    data={directoryChartData}
                                    layout="vertical"
                                    margin={{ top: 8, right: 24, left: 16, bottom: 8 }}
                                >
                                    <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" horizontal={false} />
                                    <XAxis
                                        type="number"
                                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                        axisLine={false}
                                        tickLine={false}
                                        allowDecimals={false}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="path"
                                        tick={{ fill: 'var(--foreground)', fontSize: 12 }}
                                        width={110}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(value: string) => {
                                            const parts = value.split(/[\\/]/).filter(Boolean);
                                            return parts[parts.length - 1] ?? value;
                                        }}
                                    />
                                    <Tooltip content={<DirectoryTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                                    <Bar dataKey="size" radius={[0, 10, 10, 0]} barSize={18}>
                                        {directoryChartData.map(entry => (
                                            <Cell key={entry.path} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            ) : (
                                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                                    {t('frontend.workspaceDashboard.scannedStorageOnly')}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            {directoryChartData.length > 0 ? directoryChartData.map((dir, index) => (
                                <div key={dir.path} className="rounded-xl border border-border bg-background px-4 py-3">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span
                                                    className="h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-background"
                                                    style={{ backgroundColor: dir.color }}
                                                />
                                                <div className="truncate text-sm font-medium text-foreground">{dir.path}</div>
                                            </div>
                                            <div className="mt-2 text-xs text-muted-foreground">
                                                {new Intl.NumberFormat().format(dir.fileCount)} {t('frontend.workspaceDashboard.filesLower')}
                                                {' · '}
                                                {dir.percent.toFixed(1)}%
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className="text-sm font-semibold text-foreground">{formatBytes(dir.size)}</div>
                                            <div className="text-xs text-muted-foreground">#{index + 1}</div>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                                    {t('frontend.workspaceDashboard.scannedStorageOnly')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="min-w-0 rounded-2xl border border-border bg-card p-5 space-y-4">
                    <SectionHeader
                        icon={<IconFiles className="h-4 w-4" />}
                        title={t('frontend.workspaceDashboard.mostComplexFiles')}
                    />
                    <div className="space-y-2">
                        {topFilesByLoc.length > 0 ? topFilesByLoc.slice(0, 5).map(file => (
                            <DetailItem
                                key={file.path}
                                label={`${file.loc.toLocaleString()} ${t('frontend.workspaceDashboard.linesLower')}`}
                                value={file.path}
                            />
                        )) : (
                            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                                {t('frontend.workspaceDashboard.noResults')}
                            </div>
                        )}
                    </div>
                </div>

                <div className="min-w-0 rounded-2xl border border-border bg-card p-5 space-y-4">
                    <SectionHeader
                        icon={<IconStack className="h-4 w-4" />}
                        title={t('frontend.workspaceDashboard.techStack')}
                    />
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {technologyEntries.slice(0, 12).map(tech => (
                            <div key={`${tech.name}:${tech.version}`} className="rounded-xl border border-border bg-background p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium text-foreground">{tech.name}</div>
                                        <div className="text-xs text-muted-foreground">{tech.source}</div>
                                    </div>
                                    <span className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">
                                        {tech.version}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="min-w-0 rounded-2xl border border-border bg-card p-5 space-y-4">
                    <SectionHeader
                        icon={<IconBrandTypescript className="h-4 w-4" />}
                        title={t('frontend.workspaceDashboard.langDist')}
                    />
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] lg:items-start">
                        <div ref={setLanguageChartElement} className="h-[280px] min-w-0 rounded-2xl border border-border bg-background p-3">
                            {languageChartData.length > 0 && chartsReady ? (
                                <BarChart
                                    width={languageChartWidth}
                                    height={256}
                                    data={languageChartData}
                                    layout="vertical"
                                    margin={{ top: 8, right: 24, left: 16, bottom: 8 }}
                                >
                                    <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" horizontal={false} />
                                    <XAxis
                                        type="number"
                                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                        axisLine={false}
                                        tickLine={false}
                                        allowDecimals={false}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        tick={{ fill: 'var(--foreground)', fontSize: 12 }}
                                        width={88}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                                        content={<LanguageTooltip />}
                                    />
                                    <Bar dataKey="lines" radius={[0, 10, 10, 0]} barSize={18}>
                                        {languageChartData.map(entry => (
                                            <Cell key={entry.name} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            ) : (
                                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                                    {t('frontend.workspaceDashboard.noResults')}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="rounded-xl border border-border bg-background px-4 py-3">
                                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                    {t('frontend.workspaceDashboard.languages')}
                                </div>
                                <div className="mt-1 text-lg font-semibold text-foreground">{primaryLanguage}</div>
                                <div className="text-sm text-muted-foreground">
                                    {totalLanguageWeight.toLocaleString()} {t('frontend.workspaceDashboard.linesLower')}
                                </div>
                            </div>
                            {topLanguages.length > 0 ? topLanguages.map(([lang, count], index) => {
                                const percentage = totalLanguageWeight > 0 ? ((count as number) / totalLanguageWeight) * 100 : 0;
                                return (
                                    <div key={lang} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span
                                                className="h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-background"
                                                style={{ backgroundColor: LANGUAGE_COLORS[index % LANGUAGE_COLORS.length] }}
                                            />
                                            <span className="truncate text-sm text-foreground">{lang}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground tabular-nums">
                                            {count.toLocaleString()} lines · {percentage.toFixed(1)}%
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                                    {t('frontend.workspaceDashboard.noResults')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};
