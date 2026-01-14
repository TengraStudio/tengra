
export const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => {
    return (
        <div role="alert" className="p-4 bg-destructive/10 text-destructive rounded-md">
            <h2 className="text-lg font-semibold mb-2">Something went wrong:</h2>
            <pre className="text-sm bg-background/50 p-2 rounded mb-4 overflow-auto">{error.message}</pre>
            <button
                onClick={resetErrorBoundary}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
                Try again
            </button>
        </div>
    );
};
