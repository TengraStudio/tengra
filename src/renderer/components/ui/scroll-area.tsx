/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as React from "react";

import { cn } from "@/lib/utils";


const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("relative overflow-auto scrollbar-thin", className)} {...props}>
        <div className="h-full w-full">
            {children}
        </div>
    </div>
));
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
