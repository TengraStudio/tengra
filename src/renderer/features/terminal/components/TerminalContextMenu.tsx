type TerminalContextMenuProps = {
    position: { x: number; y: number } | null;
    hasActiveSession: boolean;
    canUseGallery: boolean;
    isGalleryView: boolean;
    onCopy: () => void;
    onCopyWithFormatting?: () => void;
    onCopyStripAnsi?: () => void;
    onPaste: () => void;
    onTestPaste?: () => void;
    onSelectAll: () => void;
    onSearch: () => void;
    onSemanticToggle: () => void;
    onGalleryToggle: () => void;
    onHistoryToggle: () => void;
    onTaskRunnerToggle: () => void;
    onRecordingToggle: () => void;
    onOpenRecordings: () => void;
    onNewTerminal: () => void;
    onHidePanel: () => void;
    onClearOutput: () => void;
    onSplit: () => void;
    onDetach: () => void;
    onToggleSynchronizedInput?: () => void;
    onCloseSplit?: () => void;
    onToggleSplitOrientation?: () => void;
    splitActive: boolean;
    isSynchronizedInputEnabled?: boolean;
    isRecordingActive: boolean;
    workspacePath?: string;
    semanticIssueCount: number;
    semanticErrorCount: number;
    semanticWarningCount: number; 
    pasteHistory: string[];
    onPasteHistory: (entry: string) => void;
    labels: {
        copy: string;
        copyWithFormatting: string;
        copyStripAnsi: string;
        paste: string;
        pasteTest: string;
        pasteHistory: string;
        selectAll: string;
        search: string;
        semanticIssues: string;
        galleryView: string;
        exitGalleryView: string; 
        dockTerminal: string;
        commandHistory: string;
        runTask: string; 
        startRecording: string;
        stopRecording: string;
        sessionRecordings: string;
        clearOutput: string;
        split: string;
        synchronizedInputOn: string;
        synchronizedInputOff: string;
        detach: string;
        toggleSplitOrientation: string;
        closeSplit: string;
        newTerminal: string;
        hide: string;
    };
};

export function TerminalContextMenu({
    position,
    hasActiveSession,
    canUseGallery,
    isGalleryView,
    onCopy,
    onCopyWithFormatting,
    onCopyStripAnsi,
    onPaste,
    onTestPaste,
    onSelectAll,
    onSearch,
    onSemanticToggle,
    onGalleryToggle, 
    onHistoryToggle,
    onTaskRunnerToggle, 
    onRecordingToggle,
    onOpenRecordings,
    onNewTerminal,
    onHidePanel,
    onClearOutput,
    onSplit,
    onDetach,
    onToggleSynchronizedInput,
    onCloseSplit,
    onToggleSplitOrientation,
    splitActive,
    isSynchronizedInputEnabled,
    isRecordingActive,
    workspacePath,
    semanticIssueCount,
    semanticErrorCount,
    semanticWarningCount, 
    pasteHistory,
    onPasteHistory,
    labels,
}: TerminalContextMenuProps) {
    if (!position) {
        return null;
    }

    return (
        <div
            className="fixed min-w-48 rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl shadow-2xl py-1 z-50"
            style={{ left: position.x, top: position.y }}
            onMouseDown={event => event.stopPropagation()}
            onContextMenu={event => event.preventDefault()}
        >
            <button
                onClick={onCopy}
                className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground"
            >
                {labels.copy}
            </button>
            {onCopyWithFormatting && (
                <button
                    onClick={onCopyWithFormatting}
                    className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground"
                >
                    {labels.copyWithFormatting}
                </button>
            )}
            {onCopyStripAnsi && (
                <button
                    onClick={onCopyStripAnsi}
                    className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground"
                >
                    {labels.copyStripAnsi}
                </button>
            )}
            <button
                onClick={onPaste}
                disabled={!hasActiveSession}
                className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {labels.paste}
            </button>
            {onTestPaste && (
                <button
                    onClick={onTestPaste}
                    className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground"
                >
                    {labels.pasteTest}
                </button>
            )}
            {pasteHistory.length > 0 && (
                <div className="border-t border-border/50 mt-1 pt-1">
                    <div className="px-3 py-1 text-xxxs text-muted-foreground">
                        {labels.pasteHistory}
                    </div>
                    {pasteHistory.slice(0, 3).map((entry, index) => (
                        <button
                            key={`${index}-${entry.slice(0, 16)}`}
                            onClick={() => onPasteHistory(entry)}
                            disabled={!hasActiveSession}
                            className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed truncate"
                            title={entry}
                        >
                            {entry.replace(/\s+/g, ' ').slice(0, 70)}
                        </button>
                    ))}
                </div>
            )}
            <button
                onClick={onSelectAll}
                disabled={!hasActiveSession}
                className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {labels.selectAll}
            </button>
            <button
                onClick={onSearch}
                disabled={!hasActiveSession}
                className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {labels.search}
            </button>
            <button
                onClick={onSemanticToggle}
                disabled={!hasActiveSession}
                className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between gap-2"
            >
                <span>{labels.semanticIssues}</span>
                {semanticIssueCount > 0 && (
                    <span className="text-xxxs text-muted-foreground">
                        {semanticErrorCount}/{semanticWarningCount}
                    </span>
                )}
            </button>
            <button
                onClick={onGalleryToggle}
                disabled={!canUseGallery}
                className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {isGalleryView ? labels.exitGalleryView : labels.galleryView}
            </button> 
            <button
                onClick={onHistoryToggle}
                disabled={!hasActiveSession}
                className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {labels.commandHistory}
            </button> 
            <button
                onClick={onRecordingToggle}
                disabled={!hasActiveSession}
                className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {isRecordingActive ? labels.stopRecording : labels.startRecording}
            </button>
            <button
                onClick={onOpenRecordings}
                className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground"
            >
                {labels.sessionRecordings}
            </button>
            <button
                onClick={onTaskRunnerToggle}
                disabled={!hasActiveSession || !workspacePath}
                className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground"
            >
                {labels.runTask}
            </button>
            <button
                onClick={onClearOutput}
                disabled={!hasActiveSession}
                className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {labels.clearOutput}
            </button>
            <button
                onClick={onSplit}
                disabled={!hasActiveSession}
                className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {labels.split}
            </button>
            <button
                onClick={onDetach}
                disabled={!hasActiveSession}
                className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {labels.detach}
            </button>
            {splitActive && onToggleSynchronizedInput && (
                <button
                    onClick={onToggleSynchronizedInput}
                    disabled={!hasActiveSession}
                    className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {isSynchronizedInputEnabled
                        ? labels.synchronizedInputOn
                        : labels.synchronizedInputOff}
                </button>
            )}
            {splitActive && onToggleSplitOrientation && onCloseSplit && (
                <>
                    <button
                        onClick={onToggleSplitOrientation}
                        className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground"
                    >
                        {labels.toggleSplitOrientation}
                    </button>
                    <button
                        onClick={onCloseSplit}
                        className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground"
                    >
                        {labels.closeSplit}
                    </button>
                </>
            )}
            <div className="h-px bg-border/60 my-1 mx-2" />
            <button
                onClick={onNewTerminal}
                className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground"
            >
                {labels.newTerminal}
            </button>
            <button
                onClick={onHidePanel}
                className="w-full text-left px-3 py-2 typo-caption hover:bg-accent/50 transition-colors text-foreground"
            >
                {labels.hide}
            </button>
        </div>
    );
}
