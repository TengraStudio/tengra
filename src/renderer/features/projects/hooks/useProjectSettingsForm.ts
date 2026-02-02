import { useCallback,useMemo, useState } from 'react';

import { Project } from '@/types';

import { ProjectSettingsFormData } from '../components/settings/types';

function getBuildState(config?: Project['buildConfig']) {
    const defaults = { buildCommand: '', testCommand: '', lintCommand: '', outputDir: '', envFile: '' };
    if (!config) { return defaults; }
    return {
        buildCommand: config.buildCommand ?? defaults.buildCommand,
        testCommand: config.testCommand ?? defaults.testCommand,
        lintCommand: config.lintCommand ?? defaults.lintCommand,
        outputDir: config.outputDir ?? defaults.outputDir,
        envFile: config.envFile ?? defaults.envFile
    };
}

function getDevState(server?: Project['devServer']) {
    return {
        devCommand: server?.command ?? '',
        devPort: server?.port ?? 3000,
        devAutoStart: server?.autoStart ?? false
    };
}

function getAdvancedState(options?: Project['advancedOptions']) {
    return {
        fileWatchEnabled: options?.fileWatchEnabled ?? true,
        indexingEnabled: options?.indexingEnabled ?? true,
        autoSave: options?.autoSave ?? false
    };
}

function getInitialState(project: Project): ProjectSettingsFormData {
    return {
        title: project.title,
        description: project.description,
        status: project.status,
        councilEnabled: project.councilConfig.enabled,
        councilMembers: project.councilConfig.members,
        consensusThreshold: project.councilConfig.consensusThreshold,
        ...getBuildState(project.buildConfig),
        ...getDevState(project.devServer),
        ...getAdvancedState(project.advancedOptions)
    };
}

function checkBuildDirty(formData: ProjectSettingsFormData, config?: Project['buildConfig']): boolean {
    const defaults = getBuildState(config);
    const fields: (keyof typeof defaults)[] = ['buildCommand', 'testCommand', 'lintCommand', 'outputDir', 'envFile'];
    return fields.some(field => formData[field] !== defaults[field]);
}

function checkDevDirty(formData: ProjectSettingsFormData, server?: Project['devServer']): boolean {
    return formData.devCommand !== (server?.command ?? '') ||
        formData.devPort !== (server?.port ?? 3000) ||
        formData.devAutoStart !== (server?.autoStart ?? false);
}

function checkAdvancedDirty(formData: ProjectSettingsFormData, options?: Project['advancedOptions']): boolean {
    return formData.fileWatchEnabled !== (options?.fileWatchEnabled ?? true) ||
        formData.indexingEnabled !== (options?.indexingEnabled ?? true) ||
        formData.autoSave !== (options?.autoSave ?? false);
}

function checkIsDirty(formData: ProjectSettingsFormData, project: Project): boolean {
    const generalDirty = formData.title !== project.title ||
        formData.description !== project.description ||
        formData.status !== project.status;

    const councilDirty = formData.councilEnabled !== project.councilConfig.enabled ||
        JSON.stringify(formData.councilMembers) !== JSON.stringify(project.councilConfig.members) ||
        formData.consensusThreshold !== project.councilConfig.consensusThreshold;

    return generalDirty || councilDirty ||
        checkBuildDirty(formData, project.buildConfig) ||
        checkDevDirty(formData, project.devServer) ||
        checkAdvancedDirty(formData, project.advancedOptions);
}

export const useProjectSettingsForm = (project: Project, onUpdate: (updates: Partial<Project>) => Promise<void>) => {
    const [formData, setFormData] = useState<ProjectSettingsFormData>(() => getInitialState(project));

    const isDirty = useMemo(() => checkIsDirty(formData, project), [formData, project]);

    const handleSave = useCallback(async () => {
        const buildConfig = {
            buildCommand: formData.buildCommand,
            testCommand: formData.testCommand,
            lintCommand: formData.lintCommand,
            outputDir: formData.outputDir,
            envFile: formData.envFile
        };

        const devServer = {
            command: formData.devCommand,
            port: formData.devPort,
            autoStart: formData.devAutoStart
        };

        const advancedOptions = {
            fileWatchEnabled: formData.fileWatchEnabled,
            indexingEnabled: formData.indexingEnabled,
            autoSave: formData.autoSave,
            fileWatchIgnore: project.advancedOptions?.fileWatchIgnore,
            indexingInterval: project.advancedOptions?.indexingInterval
        };

        const updates: Partial<Project> = {
            title: formData.title,
            description: formData.description,
            status: formData.status,
            councilConfig: {
                enabled: formData.councilEnabled,
                members: formData.councilMembers,
                consensusThreshold: formData.consensusThreshold
            },
            buildConfig,
            devServer,
            advancedOptions
        };

        await onUpdate(updates);
    }, [formData, onUpdate, project.advancedOptions]);

    const handleReset = useCallback(() => {
        setFormData(getInitialState(project));
    }, [project]);

    const toggleMember = useCallback((id: string) => {
        setFormData(prev => ({
            ...prev,
            councilMembers: prev.councilMembers.includes(id)
                ? prev.councilMembers.filter(m => m !== id)
                : [...prev.councilMembers, id]
        }));
    }, []);

    return {
        formData,
        setFormData,
        isDirty,
        handleSave,
        handleReset,
        toggleMember
    };
};
