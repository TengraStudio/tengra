/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
                className={cn('rounded-lg border border-border/50 bg-card text-card-foreground', className)}
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
        <div ref={ref} className={cn('flex flex-col space-y-1 p-4', className)} {...props} />
    )
);
CardHeaderBase.displayName = 'CardHeader';
const CardHeader = React.memo(CardHeaderBase);
CardHeader.displayName = 'CardHeader';

const CardTitleBase = React.forwardRef<
    HTMLHeadingElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('font-semibold leading-none', className)} {...props} />
));
CardTitleBase.displayName = 'CardTitle';
const CardTitle = React.memo(CardTitleBase);
CardTitle.displayName = 'CardTitle';

const CardContentBase = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('p-4 pt-0', className)} {...props} />
    )
);
CardContentBase.displayName = 'CardContent';
const CardContent = React.memo(CardContentBase);
CardContent.displayName = 'CardContent';

const CardDescriptionBase = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
CardDescriptionBase.displayName = 'CardDescription';
const CardDescription = React.memo(CardDescriptionBase);
CardDescription.displayName = 'CardDescription';

export { Card, CardContent, CardDescription, CardHeader, CardTitle };
