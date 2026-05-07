/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { WorkspaceAgentPermissionPolicy } from '@shared/types/workspace-agent-session';
import { IconSettings2, IconShield, IconShieldCheck,IconShieldExclamation } from '@tabler/icons-react';
import React from 'react';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_PERMISSIONSELECTOR_1 = "flex h-8 w-8 items-center justify-center rounded-lg bg-muted/30 text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground";


interface PermissionSelectorProps {
    policy: WorkspaceAgentPermissionPolicy;
    onChange: (policy: WorkspaceAgentPermissionPolicy) => void;
    onOpenSettings?: () => void;
    t: (key: string) => string;
    className?: string;
}

function getPreset(policy: WorkspaceAgentPermissionPolicy): 'high' | 'standard' | 'full' {
    if (
        policy.commandPolicy === 'full-access' ||
        policy.pathPolicy === 'restricted-off-dangerous' ||
        policy.pathPolicy === 'full-access'
    ) {
        return 'full';
    }
    if (
        policy.commandPolicy === 'blocked' &&
        policy.pathPolicy === 'workspace-root-only'
    ) {
        return 'high';
    }
    return 'standard';
}

function buildPolicyPreset(
    preset: 'high' | 'standard' | 'full',
    current: WorkspaceAgentPermissionPolicy
): WorkspaceAgentPermissionPolicy {
    if (preset === 'high') {
        return {
            ...current,
            commandPolicy: 'blocked',
            pathPolicy: 'workspace-root-only',
            disallowedCommands: current.disallowedCommands,
        };
    }
    if (preset === 'full') {
        return {
            ...current,
            commandPolicy: 'full-access',
            pathPolicy: 'full-access',
            disallowedCommands: current.disallowedCommands,
        };
    }
    return {
        ...current,
        commandPolicy: 'ask-every-time',
        pathPolicy: 'workspace-root-only',
        disallowedCommands: current.disallowedCommands,
    };
}

function PresetIcon({
    preset,
}: {
    preset: 'high' | 'standard' | 'full';
}): React.JSX.Element {
    if (preset === 'high') {
        return <IconShieldCheck className="h-3.5 w-3.5 text-primary" />;
    }
    if (preset === 'full') {
        return <IconShieldExclamation className="h-3.5 w-3.5 text-destructive" />;
    }
    return <IconShield className="h-3.5 w-3.5 text-warning" />;
}

function getPresetLabel(
    preset: 'high' | 'standard' | 'full',
    t: (key: string) => string
): string {
    if (preset === 'high') {
        return t('frontend.workspaceAgent.permissions.policy.blocked');
    }
    if (preset === 'full') {
        return t('frontend.workspaceAgent.permissions.policy.full-access');
    }
    return t('frontend.workspaceAgent.permissions.policy.ask-every-time');
}

export const PermissionSelector: React.FC<PermissionSelectorProps> = ({
    policy,
    onChange,
    onOpenSettings,
    t,
    className,
}) => {
    const preset = getPreset(policy);

    return (
        <div className={cn('flex items-center gap-1.5', className)}>
            <Tooltip content={t('frontend.workspaceAgent.permissions.title')} side="bottom">
                <span className="inline-flex">
                    <Select
                        value={preset}
                        onValueChange={(value: string) => {
                            if (
                                value === 'high' ||
                                value === 'standard' ||
                                value === 'full'
                            ) {
                                onChange(buildPolicyPreset(value, policy));
                            }
                        }}
                    >
                        <SelectTrigger className="h-8 min-w-148 gap-1.5 rounded-lg border-none bg-muted/30 pl-2 pr-2 transition-all hover:bg-muted/50 focus:ring-0">
                            <PresetIcon preset={preset} />
                            <span className="truncate typo-body font-bold opacity-80">
                                {getPresetLabel(preset, t)}
                            </span>
                        </SelectTrigger>
                        <SelectContent
                            align="end"
                            className="min-w-180 rounded-xl border-border/40 bg-background/95 shadow-none"
                        >
                            <SelectItem value="high" className="py-2 typo-body font-bold">
                                <div className="flex items-center gap-2">
                                    <IconShieldCheck className="h-3 w-3 text-primary" />
                                    {t('frontend.workspaceAgent.permissions.policy.blocked')}
                                </div>
                            </SelectItem>
                            <SelectItem
                                value="standard"
                                className="py-2 typo-body font-bold"
                            >
                                <div className="flex items-center gap-2">
                                    <IconShield className="h-3 w-3 text-warning" />
                                    {t('frontend.workspaceAgent.permissions.policy.ask-every-time')}
                                </div>
                            </SelectItem>
                            <SelectItem value="full" className="py-2 typo-body font-bold">
                                <div className="flex items-center gap-2 text-destructive">
                                    <IconShieldExclamation className="h-3 w-3" />
                                    {t('frontend.workspaceAgent.permissions.policy.full-access')}
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </span>
            </Tooltip>

            {onOpenSettings && (
                <Tooltip content={t('frontend.workspaceAgent.permissions.title')} side="bottom">
                    <span className="inline-flex">
                        <button
                            type="button"
                            onClick={onOpenSettings}
                            className={C_PERMISSIONSELECTOR_1}
                        >
                            <IconSettings2 className="h-3.5 w-3.5" />
                        </button>
                    </span>
                </Tooltip>
            )}
        </div>
    );
};

