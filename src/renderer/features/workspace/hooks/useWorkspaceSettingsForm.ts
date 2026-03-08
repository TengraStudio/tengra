import { useCallback, useEffect, useMemo, useState } from 'react';

import { Workspace } from '@/types';

import { WorkspaceSettingsFormData } from '../components/settings/types';

function getBuildState(config?: Workspace['buildConfig']) {
    const defaults = {
        buildCommand: '',
        testCommand: '',
        lintCommand: '',
        outputDir: '',
        envFile: '',
    };
    if (!config) {
        return defaults;
    }
    return {
        buildCommand: config.buildCommand ?? defaults.buildCommand,
        testCommand: config.testCommand ?? defaults.testCommand,
        lintCommand: config.lintCommand ?? defaults.lintCommand,
        outputDir: config.outputDir ?? defaults.outputDir,
        envFile: config.envFile ?? defaults.envFile,
    };
}

function getDevState(server?: Workspace['devServer']) {
    return {
        devCommand: server?.command ?? '',
        devPort: server?.port ?? 3000,
        devAutoStart: server?.autoStart ?? false,
    };
}

function getAdvancedState(options?: Workspace['advancedOptions']) {
    return {
        fileWatchEnabled: options?.fileWatchEnabled ?? true,
        indexingEnabled: options?.indexingEnabled ?? true,
        autoSave: options?.autoSave ?? false,
    };
}

function getInitialState(workspace: Workspace): WorkspaceSettingsFormData {
    return {
        title: workspace.title,
        description: workspace.description,
        status: workspace.status,
        councilEnabled: workspace.councilConfig.enabled,
        councilMembers: workspace.councilConfig.members,
        consensusThreshold: workspace.councilConfig.consensusThreshold,
        ...getBuildState(workspace.buildConfig),
        ...getDevState(workspace.devServer),
        ...getAdvancedState(workspace.advancedOptions),
    };
}

function checkBuildDirty(
    formData: WorkspaceSettingsFormData,
    config?: Workspace['buildConfig']
): boolean {
    const defaults = getBuildState(config);
    const fields: (keyof typeof defaults)[] = [
        'buildCommand',
        'testCommand',
        'lintCommand',
        'outputDir',
        'envFile',
    ];
    return fields.some(field => formData[field] !== defaults[field]);
}

function checkDevDirty(formData: WorkspaceSettingsFormData, server?: Workspace['devServer']): boolean {
    return (
        formData.devCommand !== (server?.command ?? '') ||
        formData.devPort !== (server?.port ?? 3000) ||
        formData.devAutoStart !== (server?.autoStart ?? false)
    );
}

function checkAdvancedDirty(
    formData: WorkspaceSettingsFormData,
    options?: Workspace['advancedOptions']
): boolean {
    return (
        formData.fileWatchEnabled !== (options?.fileWatchEnabled ?? true) ||
        formData.indexingEnabled !== (options?.indexingEnabled ?? true) ||
        formData.autoSave !== (options?.autoSave ?? false)
    );
}

function checkIsDirty(formData: WorkspaceSettingsFormData, workspace: Workspace): boolean {
    const generalDirty =
        formData.title !== workspace.title ||
        formData.description !== workspace.description ||
        formData.status !== workspace.status;

    const councilDirty =
        formData.councilEnabled !== workspace.councilConfig.enabled ||
        JSON.stringify(formData.councilMembers) !== JSON.stringify(workspace.councilConfig.members) ||
        formData.consensusThreshold !== workspace.councilConfig.consensusThreshold;

    return (
        generalDirty ||
        councilDirty ||
        checkBuildDirty(formData, workspace.buildConfig) ||
        checkDevDirty(formData, workspace.devServer) ||
        checkAdvancedDirty(formData, workspace.advancedOptions)
    );
}

export const useWorkspaceSettingsForm = (
    workspace: Workspace,
    onUpdate: (updates: Partial<Workspace>) => Promise<void>
) => {
    const [formData, setFormData] = useState<WorkspaceSettingsFormData>(() =>
        getInitialState(workspace)
    );

    useEffect(() => {
        setFormData(getInitialState(workspace));
    }, [workspace]);

    const isDirty = useMemo(() => checkIsDirty(formData, workspace), [formData, workspace]);

    const handleSave = useCallback(async () => {
        const buildConfig = {
            buildCommand: formData.buildCommand,
            testCommand: formData.testCommand,
            lintCommand: formData.lintCommand,
            outputDir: formData.outputDir,
            envFile: formData.envFile,
        };

        const devServer = {
            command: formData.devCommand,
            port: formData.devPort,
            autoStart: formData.devAutoStart,
        };

        const advancedOptions = {
            fileWatchEnabled: formData.fileWatchEnabled,
            indexingEnabled: formData.indexingEnabled,
            autoSave: formData.autoSave,
            fileWatchIgnore: workspace.advancedOptions?.fileWatchIgnore,
            indexingInterval: workspace.advancedOptions?.indexingInterval,
        };

        const updates: Partial<Workspace> = {
            title: formData.title,
            description: formData.description,
            status: formData.status,
            councilConfig: {
                enabled: formData.councilEnabled,
                members: formData.councilMembers,
                consensusThreshold: formData.consensusThreshold,
            },
            buildConfig,
            devServer,
            advancedOptions,
        };

        await onUpdate(updates);
    }, [formData, onUpdate, workspace.advancedOptions]);

    const handleReset = useCallback(() => {
        setFormData(getInitialState(workspace));
    }, [workspace]);

    const toggleMember = useCallback((id: string) => {
        setFormData(prev => ({
            ...prev,
            councilMembers: prev.councilMembers.includes(id)
                ? prev.councilMembers.filter(m => m !== id)
                : [...prev.councilMembers, id],
        }));
    }, []);

    return {
        formData,
        setFormData,
        isDirty,
        handleSave,
        handleReset,
        toggleMember,
    };
};
