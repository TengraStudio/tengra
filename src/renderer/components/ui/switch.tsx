"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@renderer/lib/utils";
import * as React from "react";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border/30 transition-colors focus-visible:outline-none focus-visible:border-primary/45 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary/40 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input/80",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block h-5 w-5 rounded-full bg-background transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
