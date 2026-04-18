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

interface UseEditorScratchpadParams {
    workspacePath: string | undefined;
    activeTabName: string | undefined;
    setSnippetStatus: (status: string) => void;
}

/**
 * Manages scratchpad notes, test execution, and diagnostic output.
 */
export function useEditorScratchpad({ workspacePath, activeTabName, setSnippetStatus }: UseEditorScratchpadParams) {
    const { t } = useTranslation();
    const [scratchNote, setScratchNote] = React.useState('');
    const [scratchName, setScratchName] = React.useState('scratch-note');
    const [testOutput, setTestOutput] = React.useState('');
    const [diagnosticLines, setDiagnosticLines] = React.useState<string[]>([]);

    const runTestCommand = React.useCallback(async (mode: 'nearest' | 'file' | 'suite') => {
        if (!workspacePath) {
            return;
        }
        const fileArg = activeTabName ?? '';
        const commandByMode: Record<'nearest' | 'file' | 'suite', string[]> = {
            nearest: ['test', '--', fileArg],
            file: ['test', '--', fileArg],
            suite: ['test'],
        };
        const result = await window.electron.runCommand('npm', commandByMode[mode], workspacePath);
        const output = `${result.stdout}\n${result.stderr}`.trim();
        setTestOutput(output);
        const lines = output
            .split('\n')
            .filter(line => /fail|pass|error/i.test(line))
            .slice(0, 20);
        setDiagnosticLines(lines);
    }, [activeTabName, workspacePath]);

    const runScratchCommand = React.useCallback(async () => {
        if (!workspacePath || !scratchNote.trim()) {
            return;
        }
        const parts = scratchNote.trim().split(/\s+/);
        const command = parts[0];
        const args = parts.slice(1);
        if (!command) {
            return;
        }
        const result = await window.electron.runCommand(command, args, workspacePath);
        setTestOutput(`${result.stdout}\n${result.stderr}`.trim());
    }, [workspacePath, scratchNote]);

    const saveScratchAsDoc = React.useCallback(async () => {
        if (!workspacePath) {
            return;
        }
        const path = `${workspacePath}\\docs\\${scratchName}.md`;
        await window.electron.files.writeFile(path, scratchNote);
        setSnippetStatus(t('workspaceDashboard.editor.scratchSavedDoc'));
    }, [workspacePath, scratchName, scratchNote, t, setSnippetStatus]);

    const saveScratchAsTask = React.useCallback(async () => {
        if (!workspacePath) {
            return;
        }
        const path = `${workspacePath}\\tasks\\${scratchName}.txt`;
        await window.electron.files.writeFile(path, scratchNote);
        setSnippetStatus(t('workspaceDashboard.editor.scratchSavedTask'));
    }, [workspacePath, scratchName, scratchNote, t, setSnippetStatus]);

    return {
        scratchNote,
        setScratchNote,
        scratchName,
        setScratchName,
        testOutput,
        diagnosticLines,
        runTestCommand,
        runScratchCommand,
        saveScratchAsDoc,
        saveScratchAsTask,
    };
}
