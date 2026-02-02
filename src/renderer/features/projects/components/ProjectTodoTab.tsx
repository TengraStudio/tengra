import { useProjectTodoLogic } from '@renderer/features/projects/hooks/useProjectTodoLogic';
import { AlertCircle, CheckSquare, RefreshCw } from 'lucide-react';
import React, { useState } from 'react';

import { TodoAddForm } from './todo/TodoAddForm';
import { TodoFileGroup } from './todo/TodoFileGroup';
import { TodoHeader } from './todo/TodoHeader';

interface ProjectTodoTabProps {
    projectRoot: string
    t: (key: string) => string
}

export const ProjectTodoTab: React.FC<ProjectTodoTabProps> = ({ projectRoot, t }) => {
    const {
        todoFiles,
        loading,
        error,
        expandedFiles,
        totalStats,
        fetchTodos,
        handleToggle,
        handleAddTask,
        toggleFileExpand
    } = useProjectTodoLogic(projectRoot);

    const [isAdding, setIsAdding] = useState(false);

    if (loading && todoFiles.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                {t('projectDashboard.loadingTasks') || 'Scanning for tasks...'}
            </div>
        );
    }

    return (
        <div className="h-full overflow-hidden flex flex-col">
            <TodoHeader
                totalStats={totalStats}
                isAdding={isAdding}
                onToggleAdding={() => setIsAdding(!isAdding)}
                onRefresh={() => void fetchTodos()}
                loading={loading}
                t={t}
            />

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}

                <TodoAddForm
                    isAdding={isAdding}
                    onAdd={async (text) => {
                        await handleAddTask(text);
                        setIsAdding(false);
                    }}
                    t={t}
                />

                {todoFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-60">
                        <CheckSquare className="w-12 h-12 mb-4 opacity-20" />
                        <p>{t('projectDashboard.noTasks')}</p>
                        <p className="text-xs mt-1">{t('projectDashboard.createTodo')}</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {todoFiles.map(file => (
                            <TodoFileGroup
                                key={file.path}
                                file={file}
                                isExpanded={!!expandedFiles[file.path]}
                                onToggleExpand={toggleFileExpand}
                                onToggleItem={(item) => void handleToggle(item)}
                                t={t}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
