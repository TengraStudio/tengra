const sectionData = {
    "title": "Telemetry",
    "subtitle": "Usage insights and diagnostics",
    "status": {
        "enabled": "Telemetry enabled",
        "disabled": "Telemetry disabled",
        "paused": "Telemetry paused"
    },
    "settings": {
        "enableTelemetry": "Enable telemetry",
        "enableDescription": "Help improve Tengra by sharing anonymous usage data.",
        "dataCollection": "Data collection",
        "crashReports": "Crash reports",
        "usageStatistics": "Usage statistics",
        "performanceData": "Performance data"
    },
    "events": {
        "queued": "{{count}} queued events",
        "sent": "{{count}} events sent",
        "dropped": "{{count}} events dropped",
        "flushing": "Sending telemetry data...",
        "flushSuccess": "Telemetry data sent.",
        "flushFailed": "Couldn't send telemetry data. We'll retry later.",
        "retrying": "Retrying telemetry upload (attempt {{attempt}}/{{max}})."
    },
    "consent": {
        "title": "Telemetry consent",
        "description": "We collect anonymous usage data to improve the app.",
        "accept": "Accept",
        "decline": "Decline",
        "learnMore": "Learn more"
    }
};

export default sectionData;
