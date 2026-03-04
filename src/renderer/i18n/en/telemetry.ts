const sectionData = {
    "title": "Telemetry",
    "subtitle": "Usage analytics and diagnostics",
    "status": {
        "enabled": "Telemetry enabled",
        "disabled": "Telemetry disabled",
        "paused": "Telemetry paused"
    },
    "settings": {
        "enableTelemetry": "Enable Telemetry",
        "enableDescription": "Help improve Tengra by sending anonymous usage data.",
        "dataCollection": "Data Collection",
        "crashReports": "Crash Reports",
        "usageStatistics": "Usage Statistics",
        "performanceData": "Performance Data"
    },
    "events": {
        "queued": "{{count}} events queued",
        "sent": "{{count}} events sent",
        "dropped": "{{count}} events dropped",
        "flushing": "Sending telemetry data...",
        "flushSuccess": "Telemetry data sent successfully.",
        "flushFailed": "Failed to send telemetry data. Will retry later.",
        "retrying": "Retrying telemetry flush (attempt {{attempt}}/{{max}})."
    },
    "consent": {
        "title": "Telemetry Consent",
        "description": "We collect anonymous usage data to improve the application.",
        "accept": "Accept",
        "decline": "Decline",
        "learnMore": "Learn More"
    }
};

export default sectionData;
