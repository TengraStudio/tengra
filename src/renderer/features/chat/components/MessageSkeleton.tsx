/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */



export const MessageSkeleton = () => {
    return (
        <div className="w-full max-w-2xl animate-pulse space-y-2.5 p-1">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-6 rounded-md bg-muted/20" />
                <div className="h-3 w-24 bg-muted/20 rounded" />
            </div>
            <div className="space-y-2">
                <div className="h-4 w-3/4 bg-muted/20 rounded" />
                <div className="h-4 w-5/6 bg-muted/20 rounded" />
                <div className="h-4 w-4/6 bg-muted/20 rounded" />
            </div>
        </div>
    );
};
