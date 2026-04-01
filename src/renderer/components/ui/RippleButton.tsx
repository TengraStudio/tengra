import React, { useRef,useState } from 'react';

import { cn } from '@/lib/utils';

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'primary' | 'secondary' | 'ghost' | 'destructive'
    size?: 'sm' | 'md' | 'lg'
    children: React.ReactNode
}

interface Ripple {
    id: number
    x: number
    y: number
    size: number
}

/**
 * RippleButton Component
 * 
 * A button with Material Design-style ripple effect on click.
 * 
 * @example
 * ```tsx
 * <RippleButton variant="primary" onClick={handleClick}>
 *   Click Me
 * </RippleButton>
 * ```
 */
export const RippleButton: React.FC<RippleButtonProps> = ({
    variant = 'default',
    size = 'md',
    children,
    className,
    onClick,
    ...props
}) => {
    const [ripples, setRipples] = useState<Ripple[]>([]);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const rippleIdRef = useRef(0);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        const button = buttonRef.current;
        if (!button) {return;}

        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const size = Math.max(rect.width, rect.height) * 2;

        const newRipple: Ripple = {
            id: rippleIdRef.current++,
            x,
            y,
            size
        };

        setRipples(prev => [...prev, newRipple]);

        // Remove ripple after animation
        setTimeout(() => {
            setRipples(prev => prev.filter(r => r.id !== newRipple.id));
        }, 600);

        onClick?.(e);
    };

    const variantClasses = {
        default: 'bg-muted hover:bg-muted/80 text-foreground',
        primary: 'bg-primary hover:bg-primary/90 text-primary-foreground',
        secondary: 'bg-secondary hover:bg-secondary/80 text-secondary-foreground',
        ghost: 'hover:bg-muted/50 text-foreground',
        destructive: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
    };

    const sizeClasses = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2',
        lg: 'px-6 py-3 text-lg'
    };

    return (
        <button
            ref={buttonRef}
            onClick={handleClick}
            className={cn(
                'relative overflow-hidden rounded-lg font-medium',
                'transition-colors duration-200',
                'focus-ring',
                variantClasses[variant],
                sizeClasses[size],
                className
            )}
            {...props}
        >
            {/* Ripples */}
            {ripples.map(ripple => (
                <span
                    key={ripple.id}
                    className="absolute rounded-full bg-primary-foreground/30 pointer-events-none"
                    style={{
                        left: ripple.x - ripple.size / 2,
                        top: ripple.y - ripple.size / 2,
                        width: ripple.size,
                        height: ripple.size,
                        animation: 'ripple-expand 0.6s ease-out forwards'
                    }}
                />
            ))}
            
            {/* Content */}
            <span className="relative z-10">{children}</span>

            <style>{`
                @keyframes ripple-expand {
                    0% {
                        transform: scale(0);
                        opacity: 0.5;
                    }
                    100% {
                        transform: scale(1);
                        opacity: 0;
                    }
                }
            `}</style>
        </button>
    );
};

RippleButton.displayName = 'RippleButton';
