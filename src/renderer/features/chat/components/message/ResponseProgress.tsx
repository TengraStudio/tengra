/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const ResponseProgress = () => (
    <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden bg-primary/5">
        <div
            className="h-full w-full bg-primary/40 animate-pulse"
            style={{
                background:
                    'linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
            }}
        />
    </div>
);

