const sectionData = {
    "loading": "Loading editor...",
    "initializing": "Initializing editor...",
    "error": "Editor error: {{error}}",
    "aiRefactor": "Refactor or explain with AI",
    "suggestions": {
        "title": "Inline Suggestions",
        "description": "Show ghost-text suggestions while you type in Monaco editors.",
        "source": "Suggestion source",
        "sourceCopilot": "GitHub Copilot",
        "sourceCustom": "Custom Model",
        "provider": "Provider",
        "providerPlaceholder": "openai",
        "model": "Model",
        "modelPlaceholder": "gpt-4o-mini",
        "copilotAccount": "Copilot Account",
        "copilotAccountPlaceholder": "Use active account"
    },
    "remote": {
        "title": "Remote editor",
        "latency": "Latency: {{latency}} ms • Debounce: {{debounce}} ms",
        "saving": "Saving...",
        "saved": "Saved",
        "queuedSave": "Save queued.",
        "queuedDisconnected": "Save queued while disconnected",
        "queuedCount": "{{count}} queued save(s)",
        "flushQueue": "Send queued saves now",
        "selectFile": "Select a file to edit",
        "opened": "Opened {{path}}",
        "openFailed": "Couldn’t open the file."
    },
    "status": {
        "connected": "Connected",
        "disconnected": "Disconnected",
        "syncing": "Syncing changes..."
    }
};

export default sectionData;
