/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import { useTranslation } from '@/i18n';
import type { Workspace } from '@/types';

type WorkspaceTaskStatus = 'running' | 'stopped' | 'failed';

export interface WorkspaceTaskRuntime {
    id: string;
    command: string;
    status: WorkspaceTaskStatus;
    output: string;
    startTime: number;
}

interface UseWorkspaceTaskRunnerOptions {
    workspace: Workspace;
    notify?: (type: 'error' | 'info' | 'success', message: string) => void;
}

const MAX_TASK_OUTPUT_CHARS = 4_000;

function splitCommand(commandLine: string): { command: string; args: string[] } {
    const parts = commandLine.trim().split(/\s+/);
    return {
        command: parts[0] ?? '',
        args: parts.slice(1),
    };
}

function appendTaskOutput(currentOutput: string, chunk: string): string {
    const nextOutput = `${currentOutput}${chunk}`;
    return nextOutput.slice(-MAX_TASK_OUTPUT_CHARS);
}

function normalizeTaskStatus(status?: string): WorkspaceTaskStatus {
    if (status === 'failed') {
        return 'failed';
    }
    if (status === 'stopped') {
        return 'stopped';
    }
    return 'running';
}

function resolveDefaultWorkspaceCommand(
    workspace: Workspace,
    scripts: Record<string, string>
): string | null {
    const configuredCommands = [
        workspace.devServer?.command,
        workspace.buildConfig?.buildCommand,
        workspace.buildConfig?.testCommand,
        workspace.buildConfig?.lintCommand,
    ].map(command => command?.trim() || '');

    const configuredCommand = configuredCommands.find(command => command.length > 0);
    if (configuredCommand) {
        return configuredCommand;
    }

    if (scripts.dev) {
        return 'npm run dev';
    }
    if (scripts.start) {
        return 'npm run start';
    }
    if (scripts.build) {
        return 'npm run build';
    }
    return null;
}

function upsertTask(
    tasks: WorkspaceTaskRuntime[],
    nextTask: WorkspaceTaskRuntime
): WorkspaceTaskRuntime[] {
    const remainingTasks = tasks.filter(task => task.id !== nextTask.id);
    return [nextTask, ...remainingTasks];
}

export function useWorkspaceTaskRunner({
    workspace,
    notify,
}: UseWorkspaceTaskRunnerOptions) {
    const { t } = useTranslation();
    const [tasks, setTasks] = React.useState<WorkspaceTaskRuntime[]>([]);
    const [scripts, setScripts] = React.useState<Record<string, string>>({});
    const autoStartedWorkspaceRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        if (!workspace.path) {
            setTasks([]);
            setScripts({});
            return;
        }

        let cancelled = false;
        void window.electron.process.list().then(runningTasks => {
            if (cancelled) {
                return;
            }
            setTasks(runningTasks.map(task => ({
                id: task.id ?? `pid-${task.pid}`,
                command: task.command ?? task.cmd ?? task.name ?? '',
                status: normalizeTaskStatus(task.status),
                output: '',
                startTime: task.startTime ?? Date.now(),
            })));
        }).catch(() => {
            notify?.('error', t('frontend.errors.unexpected'));
        });

        void window.electron.process.scanScripts(workspace.path).then(nextScripts => {
            if (!cancelled) {
                setScripts(nextScripts);
            }
        }).catch(() => {
            notify?.('error', t('frontend.errors.unexpected'));
        });

        const unsubscribeData = window.electron.process.onData(({ id, data }) => {
            setTasks(previousTasks => {
                const matchedTask = previousTasks.find(task => task.id === id);
                if (!matchedTask) {
                    return upsertTask(previousTasks, {
                        id,
                        command: id,
                        status: 'running',
                        output: appendTaskOutput('', data),
                        startTime: Date.now(),
                    });
                }

                return previousTasks.map(task => (
                    task.id === id
                        ? {
                            ...task,
                            output: appendTaskOutput(task.output, data),
                        }
                        : task
                ));
            });
        });

        const unsubscribeExit = window.electron.process.onExit(({ id, code }) => {
            setTasks(previousTasks => previousTasks.map(task => (
                task.id === id
                    ? {
                        ...task,
                        status: code === 0 ? 'stopped' : 'failed',
                    }
                    : task
            )));
        });

        return () => {
            cancelled = true;
            unsubscribeData();
            unsubscribeExit();
        };
    }, [notify, t, workspace.path]);

    const defaultCommand = React.useMemo(
        () => resolveDefaultWorkspaceCommand(workspace, scripts),
        [scripts, workspace]
    );

    const runDefaultTask = React.useCallback(async () => {
        if (!workspace.path || !defaultCommand) {
            notify?.('error', t('frontend.workspace.errors.explorer.validationError'));
            return false;
        }

        const { command, args } = splitCommand(defaultCommand);
        if (!command) {
            notify?.('error', t('frontend.workspace.errors.explorer.validationError'));
            return false;
        }

        try {
            const id = await window.electron.process.spawn(command, args, workspace.path);
            setTasks(previousTasks => upsertTask(previousTasks, {
                id,
                command: defaultCommand,
                status: 'running',
                output: '',
                startTime: Date.now(),
            }));
            return true;
        } catch {
            notify?.('error', t('frontend.errors.unexpected'));
            return false;
        }
    }, [defaultCommand, notify, t, workspace.path]);

    const stopTask = React.useCallback(async (id: string) => {
        try {
            const killed = await window.electron.process.kill(id);
            if (!killed) {
                notify?.('info', t('frontend.errors.unexpected'));
                return;
            }
            setTasks(previousTasks => previousTasks.map(task => (
                task.id === id
                    ? {
                        ...task,
                        status: 'stopped',
                    }
                    : task
            )));
        } catch {
            notify?.('error', t('frontend.errors.unexpected'));
        }
    }, [notify, t]);

    const runningTaskCount = React.useMemo(
        () => tasks.filter(task => task.status === 'running').length,
        [tasks]
    );

    React.useEffect(() => {
        if (!workspace.devServer?.autoStart || !workspace.path || !defaultCommand) {
            autoStartedWorkspaceRef.current = null;
            return;
        }

        const alreadyStarted = autoStartedWorkspaceRef.current === workspace.id;
        const commandAlreadyRunning = tasks.some(
            task => task.status === 'running' && task.command === defaultCommand
        );
        if (alreadyStarted || commandAlreadyRunning) {
            return;
        }

        autoStartedWorkspaceRef.current = workspace.id;
        void runDefaultTask();
    }, [
        defaultCommand,
        runDefaultTask,
        tasks,
        workspace.devServer?.autoStart,
        workspace.id,
        workspace.path,
    ]);

    return {
        tasks,
        defaultCommand,
        runningTaskCount,
        runDefaultTask,
        stopTask,
    };
}

