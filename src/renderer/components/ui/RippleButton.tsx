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

    return (
        <button
            ref={buttonRef}
            onClick={handleClick}
            className={cn(
                'tengra-ripple-button',
                `tengra-ripple-button--${variant}`,
                `tengra-ripple-button--${size}`,
                className
            )}
            {...props}
        >
            {/* Ripples */}
            {ripples.map(ripple => (
                <span
                    key={ripple.id}
                    className="tengra-ripple-button__ripple"
                    style={{
                        left: ripple.x - ripple.size / 2,
                        top: ripple.y - ripple.size / 2,
                        width: ripple.size,
                        height: ripple.size
                    }}
                />
            ))}
            
            {/* Content */}
            <span className="tengra-ripple-button__content">{children}</span>
        </button>
    );
};

RippleButton.displayName = 'RippleButton';
