const sectionData = {
    "managementTitle": "Runtime Management",
    "statusTitle": "Runtime Status",
    "repairAction": "Repair / Reinstall",
    "installAction": "Install",
    "startAction": "Start",
    "status": {
        "ready": "Ready",
        "notConfigured": "Not configured",
        "failed": "Failed"
    },
    "health": {
        "noProbe": "No dependency health check is registered for {{componentId}}.",
        "unsupportedTarget": "No compatible runtime target is available on this platform.",
        "installPathMissing": "Couldn't determine an installation path for this component.",
        "fileMissing": "Runtime file is missing.",
        "notExecutable": "Runtime file isn't executable.",
        "fileReady": "Runtime file is ready.",
        "ollama": {
            "notInstalled": "Ollama isn't installed.",
            "notRunning": "Ollama is installed but not running.",
            "running": "Ollama is installed and running."
        }
    }
};

export default sectionData;
