const sectionData = {
    "title": "Monitoring",
    "subtitle": "System performance and health metrics",
    "status": {
        "healthy": "All systems healthy",
        "degraded": "Performance degraded",
        "critical": "Critical issues detected",
        "unknown": "Status unknown"
    },
    "metrics": {
        "cpuUsage": "CPU Usage",
        "memoryUsage": "Memory Usage",
        "diskUsage": "Disk Usage",
        "networkLatency": "Network Latency",
        "ipcLatency": "IPC Latency",
        "uptime": "Uptime",
        "responseTime": "Response Time",
        "requestsPerSecond": "Requests/sec",
        "errorRate": "Error Rate",
        "activeConnections": "Active Connections"
    },
    "actions": {
        "refresh": "Refresh Metrics",
        "exportReport": "Export Report",
        "clearAlerts": "Clear Alerts",
        "configureAlerts": "Configure Alerts",
        "viewHistory": "View History"
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
        "title": "Performance Summary",
        "uptimeLabel": "Uptime: {{duration}}",
        "memoryLabel": "Memory: {{used}} / {{total}}",
        "avgLatency": "Average Latency: {{value}}ms",
        "peakLatency": "Peak Latency: {{value}}ms"
    }
};

export default sectionData;
