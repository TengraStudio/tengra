/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
        indexingMaxFileSize: options?.indexingMaxFileSize ?? 1024 * 1024 * 10,
        indexingExclude: options?.indexingExclude?.join(', ') ?? '',
        indexingMaxConcurrency: options?.maxConcurrency ?? 4,
        autoSave: options?.autoSave ?? false,
    };
}


function getIntelligenceState(intelligence?: Workspace['intelligence']) {
    return {
        intelligenceModelId: intelligence?.defaultModelId ?? '',
        intelligenceDiscussModelId: intelligence?.discussModelId ?? '',
        intelligenceSystemPrompt: intelligence?.systemPrompt ?? '',
        intelligenceTemperature: intelligence?.temperature ?? 0.7,
    };
}

function getGitState(git?: Workspace['git']) {
    return {
        gitCommitPrefix: git?.commitPrefix ?? '',
        gitBranchPrefix: git?.branchPrefix ?? '',
        gitAutoFetch: git?.autoFetch ?? false,
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
        ...getIntelligenceState(workspace.intelligence),
        ...getGitState(workspace.git),
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
    return (
        formData.buildCommand !== defaults.buildCommand ||
        formData.testCommand !== defaults.testCommand ||
        formData.lintCommand !== defaults.lintCommand ||
        formData.outputDir !== defaults.outputDir ||
        formData.envFile !== defaults.envFile
    );
}

function checkDevDirty(formData: WorkspaceSettingsFormData, server?: Workspace['devServer']): boolean {
    const defaults = getDevState(server);
    return (
        formData.devCommand !== defaults.devCommand ||
        formData.devPort !== defaults.devPort ||
        formData.devAutoStart !== defaults.devAutoStart
    );
}

function checkAdvancedDirty(
    formData: WorkspaceSettingsFormData,
    options?: Workspace['advancedOptions']
): boolean {
    const defaults = getAdvancedState(options);
    return (
        formData.fileWatchEnabled !== defaults.fileWatchEnabled ||
        formData.indexingEnabled !== defaults.indexingEnabled ||
        formData.autoSave !== defaults.autoSave ||
        formData.indexingMaxFileSize !== defaults.indexingMaxFileSize ||
        formData.indexingExclude !== defaults.indexingExclude ||
        formData.indexingMaxConcurrency !== defaults.indexingMaxConcurrency
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

    const intelligenceDirty = 
        formData.intelligenceModelId !== (workspace.intelligence?.defaultModelId ?? '') ||
        formData.intelligenceDiscussModelId !== (workspace.intelligence?.discussModelId ?? '') ||
        formData.intelligenceSystemPrompt !== (workspace.intelligence?.systemPrompt ?? '') ||
        formData.intelligenceTemperature !== (workspace.intelligence?.temperature ?? 0.7);

    const gitDirty =
        formData.gitCommitPrefix !== (workspace.git?.commitPrefix ?? '') ||
        formData.gitBranchPrefix !== (workspace.git?.branchPrefix ?? '') ||
        formData.gitAutoFetch !== (workspace.git?.autoFetch ?? false);

    return (
        generalDirty ||
        councilDirty ||
        intelligenceDirty ||
        gitDirty ||
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
    }, [workspace.id]);

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
            layoutProfile: workspace.advancedOptions?.layoutProfile,
            indexingMaxFileSize: formData.indexingMaxFileSize,
            indexingExclude: formData.indexingExclude.split(',').map(s => s.trim()).filter(Boolean),
            maxConcurrency: formData.indexingMaxConcurrency,
        };

        const intelligence = {
            defaultModelId: formData.intelligenceModelId || undefined,
            discussModelId: formData.intelligenceDiscussModelId || undefined,
            systemPrompt: formData.intelligenceSystemPrompt || undefined,
            temperature: formData.intelligenceTemperature,
        };

        const git = {
            commitPrefix: formData.gitCommitPrefix || undefined,
            branchPrefix: formData.gitBranchPrefix || undefined,
            autoFetch: formData.gitAutoFetch,
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
            intelligence,
            git,
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
                ? prev.councilMembers.filter(memberId => memberId !== id)
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

