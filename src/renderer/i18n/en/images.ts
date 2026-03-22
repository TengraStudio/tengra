const sectionData = {
    "title": "Image Generation",
    "description": "Configure local and remote image generation providers.",
    "provider": "Image generation provider",
    "localRuntime": "Local runtime",
    "remoteCloud": "Cloud provider",
    "runtimeManagement": "Runtime management",
    "antigravity": "Antigravity (Remote)",
    "pollinations": "Pollinations (Remote)",
    "sdCpp": "stable-diffusion.cpp (Local)",
    "ollama": "Ollama (Local)",
    "sdWebUI": "Stable Diffusion WebUI",
    "comfyUI": "ComfyUI",
    "binaryPath": "Executable path",
    "modelPath": "Model path",
    "extraArgs": "Additional CLI arguments",
    "runtimeStatus": "Runtime status",
    "statusLabel": "Status",
    "status": {
        "checking": "Checking status...",
        "ready": "Ready",
        "installing": "Installing...",
        "failed": "Failed",
        "notConfigured": "Not configured"
    },
    "reinstall": "Reinstall / repair",
    "reinstallConfirm": "Are you sure you want to reinstall the SD-CPP runtime? This will redownload the binary and default model.",
    "reinstallHelp": "If the image generator is stuck or failing, a reinstall often fixes corrupted binaries or models.",
    "downloading": "Downloading...",
    "progress": "Downloaded {{downloaded}} of {{total}}",
    "pathHint": "Leave empty to use default locations in AppData.",
    "ollamaMessages": {
        "serviceUnavailable": "Ollama service is unavailable."
    },
    "ollamaStartup": {
        "alreadyRunning": "Ollama is already running.",
        "notInstalled": "Ollama is not installed. Please download it from https://ollama.com.",
        "userDeclined": "Ollama start was cancelled.",
        "startFailed": "Failed to start Ollama.",
        "started": "Ollama started.",
        "manualStartRequired": "Failed to start Ollama. Please start it manually.",
        "unexpected": "Ollama startup error: {{reason}}"
    },
    "runtimeHealth": {
        "noProbe": "No external dependency probe is registered for {{componentId}}.",
        "unsupportedTarget": "No compatible runtime target for this platform.",
        "installPathMissing": "No install path was resolved for this component.",
        "fileMissing": "Runtime file is missing.",
        "notExecutable": "Runtime file is not executable.",
        "fileReady": "Runtime file is ready.",
        "ollama": {
            "notInstalled": "Ollama is not installed.",
            "notRunning": "Ollama is installed but not running.",
            "running": "Ollama is installed and running."
        }
    }
};

export default sectionData;
