const sectionData = {
    "title": "Database",
    "subtitle": "Monitor database health and operations.",
    "status": {
        "connected": "Database is connected",
        "disconnected": "Database is disconnected",
        "migrating": "Running migrations...",
        "error": "Database error",
        "healthy": "Database is healthy"
    },
    "actions": {
        "backup": "Create Backup",
        "restore": "Restore Backup",
        "optimize": "Optimize Database",
        "vacuum": "Run Vacuum",
        "resetDatabase": "Reset Database",
        "viewStats": "View Statistics"
    },
    "stats": {
        "totalRecords": "Total records: {{count}}",
        "databaseSize": "Database size: {{size}}",
        "lastBackup": "Last backup: {{date}}",
        "queryCount": "Queries executed: {{count}}",
        "avgQueryTime": "Average query time: {{duration}}ms",
        "slowQueries": "Slow queries: {{count}}"
    },
    "migration": {
        "running": "Running migration {{name}}...",
        "completed": "Migration {{name}} completed.",
        "failed": "Migration {{name}} failed.",
        "rollback": "Rolling back migration {{name}}...",
        "upToDate": "Database is up to date."
    },
    "confirmation": {
        "resetTitle": "Reset database",
        "resetMessage": "Are you sure you want to reset the database? This can't be undone.",
        "backupBeforeReset": "Create a backup before reset"
    }
};

export default sectionData;
