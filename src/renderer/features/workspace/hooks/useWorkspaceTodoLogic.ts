/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from '@/i18n';
import { appLogger } from '@/utils/renderer-logger';

import { TodoFile, TodoItem } from '../components/todo/types';

export function useWorkspaceTodoLogic(workspaceRoot: string) {
    const { t } = useTranslation();
    const [todoFiles, setTodoFiles] = useState<TodoFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
    const undoStackRef = useRef<TodoFile[][]>([]);
    const redoStackRef = useRef<TodoFile[][]>([]);
    const [historyVersion, setHistoryVersion] = useState(0);

    const snapshotTodoFiles = useCallback((files: TodoFile[]): TodoFile[] => {
        return files.map(file => ({
            ...file,
            items: file.items.map(item => ({ ...item })),
        }));
    }, []);

    const pushUndoSnapshot = useCallback(
        (files: TodoFile[]) => {
            undoStackRef.current.push(snapshotTodoFiles(files));
            if (undoStackRef.current.length > 100) {
                undoStackRef.current.shift();
            }
            redoStackRef.current = [];
            setHistoryVersion(version => version + 1);
        },
        [snapshotTodoFiles]
    );

    const fetchTodos = useCallback(async () => {
        if (!workspaceRoot) { return; }
        setLoading(true);
        setError(null);
        try {
            const validFiles = await window.electron.code.scanTodos(workspaceRoot);
            setTodoFiles(validFiles);
            undoStackRef.current = [];
            redoStackRef.current = [];
            setHistoryVersion(version => version + 1);

            // Auto expand all by default
            const expanded: Record<string, boolean> = {};
            validFiles.forEach((f) => {
                expanded[f.path] = true;
            });
            setExpandedFiles(expanded);

        } catch (err) {
            appLogger.error('useWorkspaceTodoLogic', 'fetchTodos failed', err as Error);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, [workspaceRoot]);

    useEffect(() => {
        void fetchTodos();
    }, [fetchTodos]);

    const handleToggle = useCallback(async (item: TodoItem) => {
        try {
            const content = await window.electron.files.readFile(item.filePath);
            const lines = content.split('\n');

            // Verify line content matches to avoid drift issues
            const targetLine = lines[item.line - 1];
            if (!targetLine || (!targetLine.includes('- [ ]') && !targetLine.includes('- [x]'))) {
                throw new Error(t('frontend.workspace.errors.todoFileChanged'));
            }

            const newLine = item.completed
                ? targetLine.replace('- [x]', '- [ ]')
                : targetLine.replace('- [ ]', '- [x]');

            lines[item.line - 1] = newLine;
            await window.electron.files.writeFile(item.filePath, lines.join('\n'));

            setTodoFiles(prev => {
                pushUndoSnapshot(prev);
                return prev.map(f => {
                    if (f.path !== item.filePath) { return f; }
                    return {
                        ...f,
                        items: f.items.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i)
                    };
                });
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            void fetchTodos(); // Revert/Refresh on error
        }
    }, [fetchTodos, pushUndoSnapshot, t]);

    const handleAddTask = useCallback(async (text: string) => {
        if (!text.trim()) { return; }

        try {
            // Default to root TODO.md
            const targetPath = `${workspaceRoot}/TODO.md`;
            let content = '';

            // Check if file exists
            if (await window.electron.files.exists(targetPath)) {
                content = await window.electron.files.readFile(targetPath);
                if (content && !content.endsWith('\n')) { content += '\n'; }
            } else {
                content = `${t('frontend.workspace.todoDefaultTitle')}\n\n`;
            }

            const newTaskLine = `- [ ] ${text}`;
            const newContent = content + newTaskLine + '\n';

            await window.electron.files.writeFile(targetPath, newContent);
            pushUndoSnapshot(todoFiles);
            await fetchTodos();

        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, [fetchTodos, workspaceRoot, pushUndoSnapshot, t, todoFiles]);

    const totalStats = useMemo(() => {
        let total = 0;
        let completed = 0;
        todoFiles.forEach((f) => {
            total += f.items.length;
            f.items.forEach((i) => {
                if (i.completed) {
                    completed++;
                }
            });
        });
        return { total, completed, pending: total - completed };
    }, [todoFiles]);

    const toggleFileExpand = useCallback((path: string) => {
        setExpandedFiles(prev => ({ ...prev, [path]: !prev[path] }));
    }, []);

    const undo = useCallback(() => {
        const previous = undoStackRef.current.pop();
        if (!previous) {
            return false;
        }
        redoStackRef.current.push(snapshotTodoFiles(todoFiles));
        setTodoFiles(snapshotTodoFiles(previous));
        setHistoryVersion(version => version + 1);
        return true;
    }, [snapshotTodoFiles, todoFiles]);

    const redo = useCallback(() => {
        const next = redoStackRef.current.pop();
        if (!next) {
            return false;
        }
        undoStackRef.current.push(snapshotTodoFiles(todoFiles));
        setTodoFiles(snapshotTodoFiles(next));
        setHistoryVersion(version => version + 1);
        return true;
    }, [snapshotTodoFiles, todoFiles]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey)) {
                return;
            }
            const target = event.target as HTMLElement | null;
            const tagName = target?.tagName?.toLowerCase();
            const isTypingTarget =
                target?.isContentEditable || tagName === 'input' || tagName === 'textarea';
            if (isTypingTarget) {
                return;
            }
            const key = event.key.toLowerCase();
            if (key === 'z' && !event.shiftKey) {
                event.preventDefault();
                undo();
                return;
            }
            if (key === 'y' || (key === 'z' && event.shiftKey)) {
                event.preventDefault();
                redo();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [redo, undo]);

    return {
        todoFiles,
        loading,
        error,
        expandedFiles,
        totalStats,
        fetchTodos,
        handleToggle,
        handleAddTask,
        toggleFileExpand,
        undo,
        redo,
        canUndo: undoStackRef.current.length > 0,
        canRedo: redoStackRef.current.length > 0,
        historyVersion,
    };
}

