const sectionData = {
    "dialog": {
        "windowNotFound": "Window not found",
        "canceled": "Canceled",
        "operationFailed": "Dialog operation failed",
        "invalidOptionsProvided": "Invalid options provided",
        "saveOperationFailed": "Save operation failed"
    },
    "files": {
        "windowNotFound": "Window not found"
    },
    "window": {
        "shellOpenExternal": {
            "accessDenied": "Access denied",
            "forbiddenProtocol": "Forbidden protocol",
            "validationFailed": "Validation failed"
        },
        "shellRunCommand": {
            "validationFailed": "Command validation failed",
            "commandTooLong": "Command too long",
            "tooManyArguments": "Too many arguments",
            "argumentTooLong": "Argument too long",
            "invalidArgument": "Invalid argument",
            "executableNotAllowed": "Executable is not allowed",
            "workingDirectoryNotAllowed": "Working directory is not allowed",
            "argumentPolicyViolation": "Argument policy violation",
            "rateLimitExceeded": "Rate limit exceeded"
        }
    },
    "notificationService": {
        "notSupported": "Notifications not supported"
    },
    "clipboardService": {
        "imageNotFound": "Clipboard does not contain an image"
    },
    "mcpPlugin": {
        "permissionRequestNotFound": "Permission request not found",
        "pluginNotFound": "MCP Plugin '{{pluginName}}' not found.",
        "pluginDisabled": "Plugin '{{pluginName}}' is disabled. Enable it in Settings > MCP.",
        "actionForbiddenForProfile": "Action '{{actionName}}' is forbidden for profile '{{profile}}'. Change the server's permission profile in Settings.",
        "permissionDeniedForAction": "Permission denied for action '{{actionName}}'",
        "permissionRequiredForAction": "Permission required for '{{pluginName}}:{{actionName}}'. Approve it in MCP settings."
    },
    "webServer": {
        "invalidQuery": "Invalid query: must be non-empty string",
        "queryTooLong": "Query too long (max 500 characters)",
        "invalidUrlRequired": "Invalid URL: must be non-empty string",
        "invalidUrlProtocol": "Invalid URL: only HTTP/HTTPS protocols allowed",
        "invalidUrlFormat": "Invalid URL format"
    },
    "internetServer": {
        "invalidIpFormat": "Invalid IP address format (only IPv4 supported)",
        "invalidIpOctets": "Invalid IP address octets",
        "privateIpNotAllowed": "Private/local IP addresses not allowed (SSRF protection)",
        "invalidTimezoneFormat": "Invalid timezone format (use Area/Location, e.g., Europe/London)",
        "failedToFetchTopStories": "Failed to fetch top stories",
        "invalidCoinOrCurrency": "Invalid coin or currency format"
    },
    "networkService": {
        "invalidHostnameOrIp": "Invalid hostname or IP address",
        "invalidDomainName": "Invalid domain name",
        "whoisCommandFailed": "WHOIS command failed. Is it installed?",
        "invalidHost": "Invalid host",
        "websocketStarted": "WebSocket server started on port {{port}}"
    },
    "sshService": {
        "notConnected": "Not connected",
        "connectionProfileNotFound": "Connection profile not found",
        "reconnectAttemptsExhausted": "Reconnect attempts exhausted"
    },
    "chatExportService": {
        "chatNotFound": "Chat not found"
    },
    "extensionService": {
        "pathNotAllowed": "Extension path is not allowed",
        "packageJsonNotFound": "package.json not found",
        "noTengraConfiguration": "No tengra configuration found in package.json",
        "extensionNotFound": "Extension not found",
        "entryPointOutsideRoot": "Extension entry point resolves outside extension root",
        "activateFunctionMissing": "Extension module must export an activate function"
    },
    "utilityService": {
        "rateNotFound": "Rate not found",
        "monitorStarted": "Started monitoring {{url}}",
        "reminderSet": "Reminder set for {{time}}",
        "reminderCancelled": "Reminder cancelled",
        "reminderNotFound": "Reminder not found",
        "ghostModeEnabled": "Ghost Mode (DND) enabled. Notifications silenced.",
        "ghostModeDisabled": "Ghost Mode disabled.",
        "virusTotalApiKeyRequired": "VirusTotal API key required in arguments or settings",
        "shodanApiKeyRequired": "Shodan API key required",
        "pluginLoadingDisabled": "Plugin loading via eval is disabled for security reasons.",
        "memoryStored": "Memory stored for \"{{key}}\" (encrypted)",
        "deprecatedIndexDocument": "Deprecated. Use CodeIntelligenceService for indexing.",
        "deprecatedSearchDocuments": "Deprecated. Use ContextRetrievalService for search.",
        "deprecatedScanCodebase": "Deprecated. Use CodeIntelligenceService for scanning."
    }
};

export default sectionData;
