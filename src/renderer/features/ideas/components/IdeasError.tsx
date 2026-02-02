/**
 * Error display component for ideas page
 */
import React from 'react';

interface IdeasErrorProps {
    error: string | null
}

export const IdeasError: React.FC<IdeasErrorProps> = ({ error }) => {
    if (!error) {
        return null;
    }
    return (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive font-medium flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            {error}
        </div>
    );
};
