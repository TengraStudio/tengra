import { cn } from "@renderer/lib/utils";
import * as React from "react";

import "./scroll-area.css";

const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("tengra-scroll-area", className)} {...props}>
        <div className="tengra-scroll-area__viewport">
            {children}
        </div>
    </div>
));
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
