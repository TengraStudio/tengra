import * as React from 'react';

import { cn } from '@/lib/utils';

interface SwitchProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    id?: string;
    className?: string;
}

/**
 * A toggle switch component with smooth animations
 */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
    ({ checked, onCheckedChange, disabled, id, className }, ref) => {
        return (
            <button
                ref={ref}
                id={id}
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => onCheckedChange(!checked)}
                onContextMenu={event => event.preventDefault()}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer select-none touch-manipulation items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    checked ? 'bg-primary' : 'bg-muted',
                    className
                )}
            >
                <span
                    className={cn(
                        'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition-transform duration-200 ease-in-out',
                        checked ? 'translate-x-4' : 'translate-x-0'
                    )}
                />
            </button>
        );
    }
);

Switch.displayName = 'Switch';
