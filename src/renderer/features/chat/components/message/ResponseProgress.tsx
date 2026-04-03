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
