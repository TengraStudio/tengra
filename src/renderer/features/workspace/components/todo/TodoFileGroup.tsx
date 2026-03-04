import { ChevronDown, ChevronRight, FileText } from 'lucide-react';

import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

import { TodoItemCard } from './TodoItemCard';
import { TodoFile, TodoItem } from './types';

interface TodoFileGroupProps {
    file: TodoFile;
    isExpanded: boolean;
    onToggleExpand: (path: string) => void;
    onToggleItem: (item: TodoItem) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    t: (key: string) => string;
}

export const TodoFileGroup = ({
    file,
    isExpanded,
    onToggleExpand,
    onToggleItem,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    t,
}: TodoFileGroupProps) => {
    const pendingCount = file.items.filter(i => !i.completed).length;

    return (
        <div className="space-y-2">
            <button
                onClick={() => onToggleExpand(file.path)}
                className="w-full flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground hover:text-foreground transition-colors group select-none"
            >
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <FileText className="w-3 h-3" />
                <span className="truncate">{file.relativePath}</span>
                <div className="h-px bg-muted/20 flex-1 group-hover:bg-muted/40 transition-colors" />
                <span className={cn("px-1.5 py-0.5 rounded text-xxs", pendingCount > 0 ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground")}>
                    {pendingCount} {t('projectDashboard.pending')}
                </span>
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="grid gap-2 pl-2"
                    >
                        {file.items.map(todo => (
                            <TodoItemCard
                                key={todo.id}
                                todo={todo}
                                onToggle={(item) => onToggleItem(item)}
                                onUndo={onUndo}
                                onRedo={onRedo}
                                canUndo={canUndo}
                                canRedo={canRedo}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
