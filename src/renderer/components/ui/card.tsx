import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Generic card container used across renderer surfaces.
 * If an accessible name is present and no explicit role is passed,
 * it defaults to `region` for landmark-style navigation.
 */
const CardBase = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, role, ...props }, ref) => {
        const hasAccessibleName = Boolean(props['aria-label'] || props['aria-labelledby']);

        return (
            <div
                ref={ref}
                role={role ?? (hasAccessibleName ? 'region' : undefined)}
                className={cn('rounded-xl border bg-card text-card-foreground shadow', className)}
                {...props}
            />
        );
    }
);
CardBase.displayName = 'Card';
const Card = React.memo(CardBase);
Card.displayName = 'Card';

const CardHeaderBase = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
    )
);
CardHeaderBase.displayName = 'CardHeader';
const CardHeader = React.memo(CardHeaderBase);
CardHeader.displayName = 'CardHeader';

const CardTitleBase = React.forwardRef<
    HTMLHeadingElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('font-semibold leading-none tracking-tight', className)} {...props} />
));
CardTitleBase.displayName = 'CardTitle';
const CardTitle = React.memo(CardTitleBase);
CardTitle.displayName = 'CardTitle';

const CardContentBase = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
    )
);
CardContentBase.displayName = 'CardContent';
const CardContent = React.memo(CardContentBase);
CardContent.displayName = 'CardContent';

export { Card, CardContent, CardHeader, CardTitle };
