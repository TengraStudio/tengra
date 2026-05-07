/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex w-full rounded-2xl border bg-muted/15 px-4 py-1 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-border/35 focus-visible:border-primary/35",
        error: "border-destructive/45 text-destructive placeholder:text-destructive/50 focus-visible:border-destructive/55 focus-visible:ring-destructive/25",
        success: "border-success/45 text-success placeholder:text-success/50 focus-visible:border-success/55 focus-visible:ring-success/25",
      },
      inputSize: {
        default: "h-11",
        sm: "h-9 px-3 typo-caption rounded-xl",
        lg: "h-12 px-4 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
);

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> &
  VariantProps<typeof inputVariants> & {
    size?: VariantProps<typeof inputVariants>["inputSize"];
  };

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, type, ...props }, ref) => {
    const ariaInvalid = props['aria-invalid'] ?? (variant === 'error' ? true : undefined);
    const ariaDescribedBy = props['aria-describedby']
      ?? (variant === 'error' && typeof props.id === 'string' && props.id.length > 0
        ? `${props.id}-error`
        : undefined);

    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, inputSize: size, className }))}
        ref={ref}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };

