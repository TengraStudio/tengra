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

type WorkspaceEditor = NonNullable<Workspace['editor']>;

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

function getEditorState(editor?: Workspace['editor']) {
    return {
        editorFontSize: editor?.fontSize ?? 14,
        editorLineHeight: editor?.lineHeight ?? 1.6,
        editorMinimap: editor?.minimap ?? true,
        editorWordWrap: editor?.wordWrap ?? 'off',
        editorLineNumbers: editor?.lineNumbers ?? 'on',
        editorTabSize: editor?.tabSize ?? 4,
        editorCursorBlinking: editor?.cursorBlinking ?? 'smooth',
        editorFontLigatures: editor?.fontLigatures ?? true,
        editorFormatOnPaste: editor?.formatOnPaste ?? true,
        editorSmoothScrolling: editor?.smoothScrolling ?? true,
        editorFolding: editor?.folding ?? true,
        editorCodeLens: editor?.codeLens ?? true,
        editorInlayHints: editor?.inlayHints ?? true,
        editorAdditionalOptions: editor?.additionalOptions
            ? JSON.stringify(editor.additionalOptions, null, 2)
            : '',
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
        ...getEditorState(workspace.editor),
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

function normalizeEditorAdditionalOptions(source: string): string {
    const trimmed = source.trim();
    if (!trimmed) {
        return '';
    }

    try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
        return trimmed;
    }
}

function checkEditorDirty(formData: WorkspaceSettingsFormData, editor?: Workspace['editor']): boolean {
    const defaults = getEditorState(editor);
    return (
        formData.editorFontSize !== defaults.editorFontSize ||
        formData.editorLineHeight !== defaults.editorLineHeight ||
        formData.editorMinimap !== defaults.editorMinimap ||
        formData.editorWordWrap !== defaults.editorWordWrap ||
        formData.editorLineNumbers !== defaults.editorLineNumbers ||
        formData.editorTabSize !== defaults.editorTabSize ||
        formData.editorCursorBlinking !== defaults.editorCursorBlinking ||
        formData.editorFontLigatures !== defaults.editorFontLigatures ||
        formData.editorFormatOnPaste !== defaults.editorFormatOnPaste ||
        formData.editorSmoothScrolling !== defaults.editorSmoothScrolling ||
        formData.editorFolding !== defaults.editorFolding ||
        formData.editorCodeLens !== defaults.editorCodeLens ||
        formData.editorInlayHints !== defaults.editorInlayHints ||
        normalizeEditorAdditionalOptions(formData.editorAdditionalOptions) !==
            normalizeEditorAdditionalOptions(defaults.editorAdditionalOptions)
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
        checkAdvancedDirty(formData, workspace.advancedOptions) ||
        checkEditorDirty(formData, workspace.editor)
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
        const parseEditorAdditionalOptions = (): WorkspaceEditor['additionalOptions'] => {
            const trimmed = formData.editorAdditionalOptions.trim();
            if (!trimmed) {
                return undefined;
            }

            try {
                const parsed = JSON.parse(trimmed) as WorkspaceEditor['additionalOptions'];
                return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                    ? parsed
                    : undefined;
            } catch {
                return workspace.editor?.additionalOptions;
            }
        };

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
        };

        const editor = {
            fontSize: formData.editorFontSize,
            lineHeight: formData.editorLineHeight,
            minimap: formData.editorMinimap,
            wordWrap: formData.editorWordWrap,
            lineNumbers: formData.editorLineNumbers,
            tabSize: formData.editorTabSize,
            cursorBlinking: formData.editorCursorBlinking,
            fontLigatures: formData.editorFontLigatures,
            formatOnPaste: formData.editorFormatOnPaste,
            smoothScrolling: formData.editorSmoothScrolling,
            folding: formData.editorFolding,
            codeLens: formData.editorCodeLens,
            inlayHints: formData.editorInlayHints,
            additionalOptions: parseEditorAdditionalOptions(),
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
            editor,
        };

        await onUpdate(updates);
    }, [formData, onUpdate, workspace.advancedOptions, workspace.editor?.additionalOptions]);

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
