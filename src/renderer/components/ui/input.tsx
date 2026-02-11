import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const inputVariants = cva(
    'flex w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
    {
        variants: {
            variant: {
                default: 'border-input',
                error: 'border-destructive focus-visible:ring-destructive',
                success: 'border-success focus-visible:ring-success',
            },
            size: {
                sm: 'h-8 px-2 text-xs',
                default: 'h-10 px-3',
                lg: 'h-12 px-4 text-base',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);

export interface InputProps
    extends
        Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
        VariantProps<typeof inputVariants> {}

/**
 * Standardized Input component with consistent variants.
 *
 * @example
 * ```tsx
 * <Input placeholder="Enter text..." />
 * <Input variant="error" size="sm" />
 * <Input variant="success" size="lg" />
 * ```
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, variant, size, type = 'text', ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(inputVariants({ variant, size, className }))}
                ref={ref}
                aria-invalid={variant === 'error' ? 'true' : undefined}
                aria-describedby={
                    props['aria-describedby'] ??
                    (variant === 'error' ? `${props.id ?? 'input'}-error` : undefined)
                }
                {...props}
            />
        );
    }
);
Input.displayName = 'Input';

export { Input, inputVariants };
