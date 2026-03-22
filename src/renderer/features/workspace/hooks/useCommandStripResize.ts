import { useCallback, useRef } from 'react';

const MIN_TERMINAL_HEIGHT = 150;

interface UseCommandStripResizeParams {
    showTerminal: boolean;
    setShowTerminal: (show: boolean) => void;
    setIsMaximizedTerminal: React.Dispatch<React.SetStateAction<boolean>>;
    setIsResizingTerminal: React.Dispatch<React.SetStateAction<boolean>>;
    setTerminalHeight: (height: number) => void;
    calculateTerminalHeight: (clientY: number) => number;
    lastExpandedTerminalHeightRef: React.MutableRefObject<number>;
}

function isInteractiveResizeTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
        return false;
    }
    return Boolean(
        target.closest(
            'button, a, input, textarea, select, [role="button"], [data-radix-popper-content-wrapper]'
        )
    );
}

export function useCommandStripResize({
    showTerminal,
    setShowTerminal,
    setIsMaximizedTerminal,
    setIsResizingTerminal,
    setTerminalHeight,
    calculateTerminalHeight,
    lastExpandedTerminalHeightRef,
}: UseCommandStripResizeParams) {
    const stripResizeCleanupRef = useRef<(() => void) | null>(null);

    const stopCommandStripResize = useCallback(() => {
        stripResizeCleanupRef.current?.();
        stripResizeCleanupRef.current = null;
        setIsResizingTerminal(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, [setIsResizingTerminal]);

    const handleCommandStripResizeStart = useCallback(
        (e: React.MouseEvent) => {
            if (e.button !== 0) {
                return;
            }
            if (isInteractiveResizeTarget(e.target)) {
                return;
            }
            e.preventDefault();

            stripResizeCleanupRef.current?.();
            stripResizeCleanupRef.current = null;

            const nextHeight = calculateTerminalHeight(e.clientY);
            setTerminalHeight(nextHeight);
            lastExpandedTerminalHeightRef.current = Math.max(nextHeight, MIN_TERMINAL_HEIGHT);
            setIsMaximizedTerminal(false); 
            setIsResizingTerminal(true);
            if (!showTerminal) {
                setShowTerminal(true);
            }

            const hMove = (event: MouseEvent) => {
                const nextHeight = calculateTerminalHeight(event.clientY);
                setTerminalHeight(nextHeight);
                if (nextHeight >= MIN_TERMINAL_HEIGHT) {
                    lastExpandedTerminalHeightRef.current = nextHeight;
                }
            };
            const hUp = () => {
                stopCommandStripResize();
            };

            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
            window.addEventListener('mousemove', hMove);
            window.addEventListener('mouseup', hUp, { once: true });

            stripResizeCleanupRef.current = () => {
                window.removeEventListener('mousemove', hMove);
                window.removeEventListener('mouseup', hUp);
            };
        },
        [
            calculateTerminalHeight,
            setTerminalHeight,
            showTerminal,
            setShowTerminal,
            stopCommandStripResize,
            setIsMaximizedTerminal,
            setIsResizingTerminal,
            lastExpandedTerminalHeightRef
        ]
    );

    return {
        stopCommandStripResize,
        handleCommandStripResizeStart
    };
}
