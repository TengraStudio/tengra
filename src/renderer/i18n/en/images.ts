const sectionData = {
    "title": "Image Generation",
    "description": "Configure local and remote image generation providers.",
    "provider": "Generation Provider",
    "localRuntime": "Local Runtime",
    "remoteCloud": "Remote Cloud Provider",
    "runtimeManagement": "Runtime Management",
    "antigravity": "Antigravity (Remote)",
    "pollinations": "Pollinations (Remote)",
    "sdCpp": "stable-diffusion.cpp (Local)",
    "ollama": "Ollama (Local)",
    "sdWebUI": "Stable Diffusion WebUI",
    "comfyUI": "ComfyUI",
    "binaryPath": "Executable Path",
    "modelPath": "Model Path",
    "extraArgs": "Additional CLI Arguments",
    "runtimeStatus": "Runtime Status",
    "statusLabel": "Status",
    "status": {
        "checking": "Checking Status...",
        "ready": "Ready",
        "installing": "Installing...",
        "failed": "Failed",
        "notConfigured": "Not Configured"
    },
    "reinstall": "Reinstall / Repair",
    "reinstallConfirm": "Are you sure you want to reinstall the SD-CPP runtime? This will redownload the binary and default model.",
    "reinstallHelp": "If the image generator is stuck or failing, a reinstall often fixes corrupted binaries or models.",
    "downloading": "Downloading...",
    "progress": "Downloaded {{downloaded}} of {{total}}",
    "pathHint": "Leave empty to use default locations in AppData."
};

export default sectionData;
