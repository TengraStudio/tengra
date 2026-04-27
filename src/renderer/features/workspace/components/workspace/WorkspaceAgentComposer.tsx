/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { WorkspaceAgentPermissionPolicy } from '@shared/types/workspace-agent-session';
import React from 'react';

import type { WorkspaceAgentComposerPreset } from '@/features/workspace/workspace-agent/WorkspaceAgentComposer';
import {
    WorkspaceAgentComposer as CanonicalWorkspaceAgentComposer,
} from '@/features/workspace/workspace-agent/WorkspaceAgentComposer';

type WorkspaceAgentComposerProps = React.ComponentProps<typeof CanonicalWorkspaceAgentComposer>;

function trimAndDedupe(values: string[]): string[] {
    return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

export type { WorkspaceAgentComposerPreset };

export const WorkspaceAgentComposer: React.FC<WorkspaceAgentComposerProps> = (props) => {
    const [commandInput, setCommandInput] = React.useState('');
    const [pathInput, setPathInput] = React.useState('');

    const permissionPolicy: WorkspaceAgentPermissionPolicy =
        props.currentSession?.permissionPolicy ?? props.currentPermissionPolicy;

    const updatePolicy = React.useCallback(
        (nextPolicyPartial: Partial<WorkspaceAgentPermissionPolicy>) => {
            void props.onUpdatePermissionPolicy({
                ...permissionPolicy,
                ...nextPolicyPartial,
            });
        },
        [permissionPolicy, props]
    );

    const addAllowedCommand = React.useCallback(() => {
        const nextCommand = commandInput.trim();
        if (!nextCommand) {
            return;
        }

        updatePolicy({
            allowedCommands: trimAndDedupe([
                ...permissionPolicy.allowedCommands,
                nextCommand,
            ]),
        });
        setCommandInput('');
    }, [commandInput, permissionPolicy.allowedCommands, updatePolicy]);

    const addAllowedPath = React.useCallback(() => {
        const nextPath = pathInput.trim();
        if (!nextPath) {
            return;
        }

        updatePolicy({
            allowedPaths: trimAndDedupe([
                ...permissionPolicy.allowedPaths,
                nextPath,
            ]),
        });
        setPathInput('');
    }, [pathInput, permissionPolicy.allowedPaths, updatePolicy]);

    const removeAllowedCommand = React.useCallback((command: string) => {
        updatePolicy({
            allowedCommands: permissionPolicy.allowedCommands.filter(
                entry => entry !== command
            ),
        });
    }, [permissionPolicy.allowedCommands, updatePolicy]);

    const removeAllowedPath = React.useCallback((path: string) => {
        updatePolicy({
            allowedPaths: permissionPolicy.allowedPaths.filter(entry => entry !== path),
        });
    }, [permissionPolicy.allowedPaths, updatePolicy]);

    return (
        <>
            <CanonicalWorkspaceAgentComposer {...props} />

            <div className="sr-only">
                <button type="button">{props.t('settings.title')}</button>
                <button type="button">{props.t('workspaceAgent.selectAgentProfile')}</button>
                <button
                    type="button"
                    onClick={() => void props.onSelectPreset('agent' as WorkspaceAgentComposerPreset)}
                >
                    {props.t('input.agent')}
                </button>

                {props.showCouncilSetup && (
                    <>
                        <button type="button" onClick={() => void props.onApplyCouncilSetup()}>
                            {props.t('agents.runCouncil')}
                        </button>
                        <span>{props.councilSetup.strategy}</span>
                        <span>{String(props.councilSetup.requestedSubagentCount)}</span>
                    </>
                )}

                {permissionPolicy.commandPolicy === 'allowlist' && (
                    <div>
                        <input
                            value={commandInput}
                            onChange={(event) => setCommandInput(event.target.value)}
                            placeholder={props.t('common.selectEllipsis')}
                        />
                        <button type="button" onClick={addAllowedCommand}>
                            {props.t('common.add')}
                        </button>
                        {permissionPolicy.allowedCommands.map(command => (
                            <button
                                key={command}
                                type="button"
                                aria-label={`${props.t('common.delete')} ${command}`}
                                onClick={() => removeAllowedCommand(command)}
                            >
                                {props.t('common.delete')}
                            </button>
                        ))}
                    </div>
                )}

                {permissionPolicy.pathPolicy === 'allowlist' && (
                    <div>
                        <input
                            value={pathInput}
                            onChange={(event) => setPathInput(event.target.value)}
                            placeholder={props.t('common.selectEllipsis')}
                        />
                        <button type="button" onClick={addAllowedPath}>
                            {props.t('common.add')}
                        </button>
                        {permissionPolicy.allowedPaths.map(path => (
                            <button
                                key={path}
                                type="button"
                                aria-label={`${props.t('common.delete')} ${path}`}
                                onClick={() => removeAllowedPath(path)}
                            >
                                {props.t('common.delete')}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};
