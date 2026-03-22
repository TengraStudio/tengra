const sectionData = {
    "title": "Monitoring",
    "subtitle": "System performance and health status",
    "status": {
        "healthy": "All systems healthy",
        "degraded": "Performance degraded",
        "critical": "Critical issues detected",
        "unknown": "Status unknown"
    },
    "metrics": {
        "cpuUsage": "CPU usage",
        "memoryUsage": "Memory usage",
        "diskUsage": "Disk usage",
        "networkLatency": "Network latency",
        "ipcLatency": "IPC latency",
        "uptime": "Uptime",
        "responseTime": "Response time",
        "requestsPerSecond": "Requests/sec",
        "errorRate": "Error rate",
        "activeConnections": "Active connections"
    },
    "actions": {
        "refresh": "Refresh metrics",
        "exportReport": "Export report",
        "clearAlerts": "Clear alerts",
        "configureAlerts": "Configure alerts",
        "viewHistory": "View history"
    },
    "alerts": {
        "title": "Alerts",
        "noAlerts": "No active alerts",
        "critical": "Critical",
        "warning": "Warning",
        "info": "Info",
        "acknowledged": "Alert acknowledged"
    },
    "summary": {
        "title": "Performance summary",
        "uptimeLabel": "Uptime: {{duration}}",
        "memoryLabel": "Memory: {{used}} / {{total}}",
        "avgLatency": "Average latency: {{value}}ms",
        "peakLatency": "Peak latency: {{value}}ms"
    }
};

export default sectionData;
