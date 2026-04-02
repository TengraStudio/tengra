import type { WorkspaceAgentPermissionPolicy } from '@shared/types/workspace-agent-session';
import { Plus, X } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface WorkspaceAgentPermissionEditorProps {
    permissionPolicy: WorkspaceAgentPermissionPolicy;
    onUpdatePermissions: (permissionPolicy: WorkspaceAgentPermissionPolicy) => void;
    t: (key: string) => string;
}

function normalizeValue(value: string): string {
    return value.trim();
}

function dedupeValues(values: string[]): string[] {
    return Array.from(new Set(values.map(normalizeValue).filter(Boolean)));
}

function AllowlistSection({
    entries,
    icon,
    inputValue,
    label,
    onAddEntry,
    onInputChange,
    onRemoveEntry,
    noEntriesLabel,
    addLabel,
    t,
}: {
    entries: string[];
    icon: React.ReactNode;
    inputValue: string;
    label: string;
    onAddEntry: () => void;
    onInputChange: (value: string) => void;
    onRemoveEntry: (entry: string) => void;
    noEntriesLabel: string;
    addLabel: string;
    t: (key: string) => string;
}): JSX.Element {
    return (
        <div className="rounded-2xl border border-border/40 bg-background/40 p-4">
            <div className="flex items-center gap-2 tw-text-10 font-bold tw-tracking-20 text-muted-foreground/30">
                {icon}
                <span>{label}</span>
            </div>
            <div className="mt-3 flex gap-2">
                <Input
                    value={inputValue}
                    onChange={event => onInputChange(event.target.value)}
                    placeholder={t('common.selectEllipsis')}
                    className="h-9 rounded-xl border border-border/40 bg-background/50 text-xs focus:ring-0 focus:border-border/60 transition-all"
                />
                <Button variant="secondary" onClick={onAddEntry} className="h-9 rounded-xl px-4 bg-primary/10 hover:bg-primary/20 text-primary tw-text-10 font-bold border border-primary/20 transition-all shrink-0">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    {addLabel}
                </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
                {entries.length > 0 ? (
                    entries.map(entry => (
                        <Badge
                            key={entry}
                            variant="outline"
                            className="gap-1.5 rounded-lg border-border/30 bg-muted/40 px-2.5 py-1 tw-text-10 font-bold text-foreground/70"
                        >
                            <span className="truncate tw-max-w-150">{entry}</span>
                            <button
                                type="button"
                                className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-muted-foreground/30 transition-colors hover:text-destructive/60"
                                onClick={() => onRemoveEntry(entry)}
                                aria-label={`${t('common.delete')} ${entry}`}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))
                ) : (
                    <div className="tw-text-10 text-muted-foreground/30 flex items-center gap-2 px-1 py-1 font-medium">
                        {noEntriesLabel}
                    </div>
                )}
            </div>
        </div>
    );
}

export const WorkspaceAgentPermissionEditor: React.FC<
    WorkspaceAgentPermissionEditorProps
> = ({ permissionPolicy, onUpdatePermissions, t }) => {
    const [commandInput, setCommandInput] = React.useState('');
    const [pathInput, setPathInput] = React.useState('');

    const applyEntries = React.useCallback(
        (nextPartial: Partial<WorkspaceAgentPermissionPolicy>) => {
            onUpdatePermissions({
                ...permissionPolicy,
                ...nextPartial,
            });
        },
        [onUpdatePermissions, permissionPolicy]
    );

    const addCommand = React.useCallback(() => {
        const nextValue = normalizeValue(commandInput);
        if (!nextValue) {
            return;
        }
        applyEntries({
            allowedCommands: dedupeValues([
                ...permissionPolicy.allowedCommands,
                nextValue,
            ]),
        });
        setCommandInput('');
    }, [applyEntries, commandInput, permissionPolicy.allowedCommands]);

    const removeCommand = React.useCallback(
        (entry: string) => {
            applyEntries({
                allowedCommands: permissionPolicy.allowedCommands.filter(
                    command => command !== entry
                ),
            });
        },
        [applyEntries, permissionPolicy.allowedCommands]
    );

    const addPath = React.useCallback(() => {
        const nextValue = normalizeValue(pathInput);
        if (!nextValue) {
            return;
        }
        applyEntries({
            allowedPaths: dedupeValues([...permissionPolicy.allowedPaths, nextValue]),
        });
        setPathInput('');
    }, [applyEntries, pathInput, permissionPolicy.allowedPaths]);

    const removePath = React.useCallback(
        (entry: string) => {
            applyEntries({
                allowedPaths: permissionPolicy.allowedPaths.filter(path => path !== entry),
            });
        },
        [applyEntries, permissionPolicy.allowedPaths]
    );

    if (
        permissionPolicy.commandPolicy !== 'allowlist' &&
        permissionPolicy.pathPolicy !== 'allowlist'
    ) {
        return <></>;
    }

    return (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
            {permissionPolicy.commandPolicy === 'allowlist' && (
                <AllowlistSection
                    entries={permissionPolicy.allowedCommands}
                    icon={<Plus className="h-3.5 w-3.5" />}
                    inputValue={commandInput}
                    label={t('workspaceAgent.permissions.allowedCommands')}
                    onAddEntry={addCommand}
                    onInputChange={setCommandInput}
                    onRemoveEntry={removeCommand}
                    noEntriesLabel={t('workspaceAgent.permissions.noCommands')}
                    addLabel={t('workspaceAgent.permissions.addCommand')}
                    t={t}
                />
            )}
            {permissionPolicy.pathPolicy === 'allowlist' && (
                <AllowlistSection
                    entries={permissionPolicy.allowedPaths}
                    icon={<Plus className="h-3.5 w-3.5" />}
                    inputValue={pathInput}
                    label={t('workspaceAgent.permissions.allowedPaths')}
                    onAddEntry={addPath}
                    onInputChange={setPathInput}
                    onRemoveEntry={removePath}
                    noEntriesLabel={t('workspaceAgent.permissions.noPaths')}
                    addLabel={t('workspaceAgent.permissions.addPath')}
                    t={t}
                />
            )}
        </div>
    );
};
