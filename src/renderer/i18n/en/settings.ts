const sectionData = {
    "tabs": {
        "general": "General",
        "appearance": "Appearance",
        "models": "Models",
        "accounts": "Connected Accounts",
        "personas": "Personas",
        "speech": "Speech",
        "statistics": "Statistics",
        "advanced": "Advanced",
        "developer": "Developer",
        "about": "About",
        "images": "Images",
        "mcpServers": "MCP Servers",
        "mcpMarketplace": "MCP Marketplace",
        "accessibility": "Accessibility"
    },
    "searchPlaceholder": "Search settings...",
    "searchResults": "Found {count} matching settings",
    "noResults": "No settings found",
    "title": "Settings",
    "subtitle": "Configure application preferences.",
    "general": "General",
    "accounts": "Accounts",
    "models": "Models",
    "usage-limits": "Usage Limits",
    "appearance": "Appearance",
    "speech": "Speech",
    "advanced": "Advanced",
    "developer": "Developer",
    "statistics": "Statistics",
    "gallery": "Gallery",
    "about": "About",
    "personas": "Personas",
    "accessibility": {
        "title": "Accessibility",
        "description": "Customize your experience for better accessibility",
        "highContrast": "High Contrast Mode",
        "highContrastDesc": "Increase contrast for better visibility",
        "reducedMotion": "Reduced Motion",
        "reducedMotionDesc": "Minimize animations and transitions",
        "enhancedFocus": "Enhanced Focus Indicators",
        "enhancedFocusDesc": "Make focus states more visible",
        "screenReader": "Screen Reader Announcements",
        "screenReaderDesc": "Enable announcements for screen readers",
        "systemPrefs": "System Preferences",
        "systemPrefsDesc": "Some settings automatically detect your system preferences. Enable \"Reduced Motion\" or \"High Contrast\" in your operating system for automatic detection.",
        "shortcuts": "Keyboard Shortcuts",
        "tabNav": "Navigate between elements",
        "tabNavBack": "Navigate backwards",
        "activate": "Activate focused element",
        "escape": "Close modal or cancel",
        "arrowNav": "Navigate within lists",
        "skipToMainContent": "Skip to main content"
    },
    "factoryResetConfirm": "Are you sure you want to delete all data?",
    "language": "Language",
    "theme": "Theme",
    "mcpServers": "MCP Servers",
    "factoryReset": "Factory Reset",
    "usageLimits": {
        "title": "Model Usage Limits",
        "enable": "Enable",
        "maxPercentQuota": "Max Percentage of Remaining Quota (%)",
        "maxPercentPlaceholder": "50",
        "maxRequests": "Max Requests",
        "maxPercentage": "Max Percentage (%)",
        "maxRequestsPlaceholder": "5",
        "maxPercentagePlaceholder": "50",
        "typeLabel": "Type:",
        "limitLabel": "{{period}} Limit",
        "percentHint": "Will limit to {{count}} requests ({{percentage}}% of {{remaining}} remaining)",
        "types": {
            "requests": "Requests",
            "percentage": "Percentage"
        },
        "periods": {
            "hourly": "Hourly",
            "daily": "Daily",
            "weekly": "Weekly"
        },
        "copilot": {
            "title": "Copilot",
            "current": "Current: {{remaining}} / {{limit}} remaining"
        },
        "antigravity": {
            "title": "Antigravity Models",
            "description": "Set percentage limit based on each model's remaining quota"
        },
        "codex": {
            "title": "Codex",
            "description": "Set percentage limits based on daily/weekly remaining quota"
        }
    },
    "browserClosure": {
        "title": "Browser Closure Required",
        "description": "To authenticate with {{provider}}, Tengra needs to read protected cookies.",
        "warningPrefix": "We must",
        "warningEmphasis": "automatically close your browser",
        "warningSuffix": "to release the file lock.",
        "saveWork": "Please save your work in the browser before proceeding. We will re-open it invisibly to extract the session key.",
        "confirm": "Close Browser & Connect"
    },
    "hyperparameters": {
        "title": "Hyperparameters",
        "temperature": {
            "label": "Temperature",
            "description": "Creativity level (0: deterministic, 2: very creative)"
        },
        "topP": {
            "label": "Top-P",
            "description": "Nucleus sampling probability threshold"
        },
        "topK": {
            "label": "Top-K",
            "description": "Number of most likely tokens to consider"
        },
        "repeatPenalty": {
            "label": "Repeat Penalty",
            "description": "Repetition penalty (1: none, 2: high)"
        }
    },
    "mcp": {
        "title": "Model Context Protocol",
        "subtitle": "Manage your MCP servers and install new tools",
        "tabs": {
            "servers": "Servers",
            "marketplace": "Marketplace"
        },
        "servers": {
            "title": "Configured Servers",
            "subtitle": "Manage your Model Context Protocol server connections",
            "connect": "Connect Server",
            "empty": "No servers connected",
            "emptyHint": "Install servers from the Marketplace tab",
            "enabled": "enabled",
            "note": "Note",
            "noteText": "Only enabled servers are accessible to AI assistants. Toggle the power button to enable/disable each server.",
            "internalAlwaysEnabled": "Internal tools are always enabled"
        },
        "status": {
            "connected": "Connected",
            "disconnected": "Disconnected",
            "error": "Error",
            "enabled": "Enabled",
            "disabled": "Disabled",
            "active": "Active",
            "inactive": "Inactive"
        }
    },
    "images": {
        "reinstallConfirm": "Are you sure you want to reinstall this image?",
        "title": "Image Settings",
        "description": "Manage image generation settings",
        "provider": "Provider",
        "localRuntime": "Local Runtime",
        "remoteCloud": "Remote Cloud",
        "runtimeManagement": "Runtime Management",
        "reinstall": "Reinstall",
        "reinstallHelp": "Reinstall the runtime if corrupted",
        "operationsTitle": "Image Operations",
        "refreshData": "Refresh Image Data",
        "historyTitle": "Generation History",
        "noHistory": "No image generation history yet.",
        "regenerate": "Regenerate",
        "compareSelectionHint": "Select at least two history entries to compare.",
        "compareRun": "Run Comparison",
        "compareClear": "Clear Selection",
        "compareTitle": "Comparison Summary",
        "presetsTitle": "Generation Presets",
        "noPresets": "No presets saved yet.",
        "presetName": "Preset Name",
        "promptPrefix": "Prompt Prefix",
        "savePreset": "Save Preset",
        "schedulesTitle": "Scheduled Generations",
        "noSchedules": "No scheduled generations.",
        "schedulePrompt": "Schedule Prompt",
        "scheduleAt": "Run At",
        "scheduleCreate": "Create Schedule",
        "scheduleCancel": "Cancel Schedule",
        "queueTitle": "Generation Queue",
        "queueStatus": "Queue Status",
        "queueRunning": "Running",
        "queueIdle": "Idle",
        "batchTitle": "Batch Generation",
        "batchPrompts": "Batch Prompts",
        "batchRun": "Run Batch",
        "editTitle": "Image Editing",
        "editSource": "Source Image Path or URL",
        "editPrompt": "Edit Prompt",
        "editMode": "Edit Mode",
        "editRun": "Run Edit"
    }
};

export default sectionData;
