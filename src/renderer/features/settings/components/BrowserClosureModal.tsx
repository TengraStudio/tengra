import { AlertTriangle, X } from 'lucide-react';
import React from 'react';

interface BrowserClosureModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    providerName: string
}

export const BrowserClosureModal: React.FC<BrowserClosureModalProps> = ({ isOpen, onClose, onConfirm, providerName }) => {
    if (!isOpen) { return null; }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-2 text-amber-500">
                        <AlertTriangle className="h-5 w-5" />
                        <h3 className="font-bold text-foreground">Browser Closure Required</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        To authenticate with <strong className="text-foreground">{providerName}</strong>, Orbit needs to read protected cookies.
                    </p>
                    <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <p className="text-xs font-medium text-amber-500">
                            We must <span className="underline decoration-2 underline-offset-2">automatically close your browser</span> to release the file lock.
                        </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Please save your work in the browser before proceeding. We will re-open it invisibly to extract the session key.
                    </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-border bg-muted/20">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-amber-500 hover:bg-amber-600 text-foreground shadow-lg shadow-amber-500/20 transition-all"
                    >
                        Close Browser & Connect
                    </button>
                </div>
            </div>
        </div>
    );
};
