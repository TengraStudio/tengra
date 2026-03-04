const sectionData = {
    "title": "Database",
    "subtitle": "Database management and health",
    "status": {
        "connected": "Database connected",
        "disconnected": "Database disconnected",
        "migrating": "Running migrations...",
        "error": "Database error",
        "healthy": "Database healthy"
    },
    "actions": {
        "backup": "Create Backup",
        "restore": "Restore Backup",
        "optimize": "Optimize Database",
        "vacuum": "Vacuum Database",
        "resetDatabase": "Reset Database",
        "viewStats": "View Statistics"
    },
    "stats": {
        "totalRecords": "Total Records: {{count}}",
        "databaseSize": "Database Size: {{size}}",
        "lastBackup": "Last Backup: {{date}}",
        "queryCount": "Queries Executed: {{count}}",
        "avgQueryTime": "Avg Query Time: {{duration}}ms",
        "slowQueries": "Slow Queries: {{count}}"
    },
    "migration": {
        "running": "Running migration {{name}}...",
        "completed": "Migration {{name}} completed.",
        "failed": "Migration {{name}} failed.",
        "rollback": "Rolling back migration {{name}}...",
        "upToDate": "Database is up to date."
    },
    "confirmation": {
        "resetTitle": "Reset Database",
        "resetMessage": "Are you sure you want to reset the database? This action cannot be undone.",
        "backupBeforeReset": "Create backup before reset"
    }
};

export default sectionData;
