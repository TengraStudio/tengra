// Toast container component

import { cn } from '@/lib/utils';
import { Toast } from '@/types';

interface ToastsContainerProps {
    toasts: Toast[];
    removeToast: (id: string) => void;
}

export function ToastsContainer({ toasts, removeToast }: ToastsContainerProps) {
    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={cn(
                        'px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-md animate-in slide-in-from-right-full duration-300 pointer-events-auto flex items-center justify-center gap-3 min-w-[240px]',
                        toast.type === 'success'
                            ? 'bg-success/20 border-success/30 text-success'
                            : toast.type === 'error'
                              ? 'bg-destructive/20 border-destructive/30 text-destructive'
                              : 'bg-muted/80 border-white/10 text-foreground'
                    )}
                >
                    <span className="text-lg">
                        {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
                    </span>
                    <div className="text-sm font-medium">{toast.message}</div>
                    <button
                        onClick={() => {
                            removeToast(toast.id);
                        }}
                        className="ms-auto opacity-50"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}
