import { Terminal } from 'lucide-react';

type TerminalEmptyStateProps = {
    title: string;
    actionLabel: string;
    onCreate: () => void;
};

export function TerminalEmptyState({ title, actionLabel, onCreate }: TerminalEmptyStateProps) {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground opacity-50">
            <Terminal className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">{title}</p>
            <button
                onClick={onCreate}
                className="mt-4 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg typo-caption font-bold transition-all border border-primary/30"
            >
                {actionLabel}
            </button>
        </div>
    );
}
