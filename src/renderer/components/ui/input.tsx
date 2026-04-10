import { cn } from "@renderer/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const inputVariants = cva(
  "flex w-full rounded-md border bg-background px-3 py-1 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-border/50 focus-visible:border-primary/40",
        error: "border-destructive/45 text-destructive placeholder:text-destructive/50 focus-visible:border-destructive/55 focus-visible:ring-destructive/25",
        success: "border-success/45 text-success placeholder:text-success/50 focus-visible:border-success/55 focus-visible:ring-success/25",
      },
      inputSize: {
        default: "h-9",
        sm: "h-8 px-2 typo-caption",
        lg: "h-10 px-3.5 text-sm",
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
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, inputSize: size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };
