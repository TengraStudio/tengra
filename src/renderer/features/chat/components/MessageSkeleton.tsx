

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
