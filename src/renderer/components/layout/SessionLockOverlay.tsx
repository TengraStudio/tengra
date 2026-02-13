import { Lock } from 'lucide-react';

interface SessionLockOverlayProps {
    isOpen: boolean;
    lockedAt?: number;
    canUseBiometric: boolean;
    onUnlock: () => void;
}

export function SessionLockOverlay({
    isOpen,
    lockedAt,
    canUseBiometric,
    onUnlock,
}: SessionLockOverlayProps) {
    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4 shadow-2xl">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <Lock className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold">Session Locked</h2>
                        <p className="text-xs text-muted-foreground">
                            Idle timeout reached{lockedAt ? ` at ${new Date(lockedAt).toLocaleTimeString()}` : ''}.
                        </p>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground">
                    Your app state is preserved. Unlock to continue where you left off.
                </p>
                <div className="flex gap-2">
                    <button
                        type="button"
                        className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
                        onClick={onUnlock}
                    >
                        Unlock
                    </button>
                    {canUseBiometric && (
                        <button
                            type="button"
                            className="px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40"
                            onClick={onUnlock}
                        >
                            Unlock with Biometric
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

