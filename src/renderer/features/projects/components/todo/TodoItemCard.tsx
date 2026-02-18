import { CheckSquare, RotateCcw, RotateCw, Square } from 'lucide-react';

import { cn } from '@/lib/utils';

import { TodoItem } from './types';

interface TodoItemCardProps {
    todo: TodoItem;
    onToggle: (item: TodoItem) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
}

export const TodoItemCard = ({ todo, onToggle, onUndo, onRedo, canUndo, canRedo }: TodoItemCardProps) => (
    <div
        className={cn(
            "group flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden",
            todo.completed
                ? "bg-muted/10 border-border/20 hover:bg-muted/20 opacity-60 hover:opacity-100"
                : "bg-card border-border/50 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
        )}
        onClick={() => onToggle(todo)}
    >
        {todo.completed ? (
            <CheckSquare className="w-5 h-5 text-success shrink-0 mt-0.5" />
        ) : (
            <Square className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
        )}

        <div className="flex-1 min-w-0">
            <p className={cn(
                "text-sm leading-relaxed break-words transition-colors",
                todo.completed ? "text-muted-foreground line-through decoration-muted-foreground/20" : "text-foreground/90"
            )}>
                {todo.text}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xxs font-mono text-muted-foreground/40 text-primary/40">
                    Line {todo.line}
                </span>
                {(onUndo || onRedo) && (
                    <div className="ml-auto flex items-center gap-1">
                        {onUndo && (
                            <button
                                type="button"
                                onClick={event => {
                                    event.stopPropagation();
                                    onUndo();
                                }}
                                disabled={!canUndo}
                                className="p-1 rounded hover:bg-muted/40 disabled:opacity-30"
                                title="Undo (Ctrl/Cmd+Z)"
                            >
                                <RotateCcw className="w-3 h-3" />
                            </button>
                        )}
                        {onRedo && (
                            <button
                                type="button"
                                onClick={event => {
                                    event.stopPropagation();
                                    onRedo();
                                }}
                                disabled={!canRedo}
                                className="p-1 rounded hover:bg-muted/40 disabled:opacity-30"
                                title="Redo (Ctrl/Cmd+Y)"
                            >
                                <RotateCw className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
);
