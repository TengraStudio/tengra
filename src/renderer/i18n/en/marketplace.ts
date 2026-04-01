const marketplace = {
    "title": "Marketplace",
    "subtitle": "Expand your AI possibilities",
    "tabs": {
        "mcp": "MCP Modules",
        "themes": "Visual Themes",
        "personas": "Agent Personalities",
        "models": "AI Models",
        "prompts": "Prompt Library"
    },
    "mcp": {
        "title": "Model Context Protocol",
        "description": "Powerful, secure, and extensible interfaces for your assistant. Connect to your system, network, and tools with precision.",
        "search": "Search modules...",
        "filters": {
            "all": "All",
            "core": "Internal",
            "user": "External"
        },
        "stats": {
            "active": "Active",
            "inactive": "Standby",
            "builtin": "Built-in Core",
            "local": "Local Plugin",
            "tools": "Available Tools",
            "modules_found": "Modules Found"
        },
        "plugins": {
            "filesystem": {
                "description": "File read, write, list, and management tools (including zip, download, etc.)"
            },
            "command": {
                "description": "Local terminal command execution system with security controls"
            },
            "system": {
                "description": "Hardware resources, CPU/memory usage, and system status monitoring tools"
            },
            "network": {
                "description": "Network diagnostics, DNS lookup, and connectivity check tools"
            },
            "workspace": {
                "description": "Project files and workspace management utilities"
            },
            "docker": {
                "description": "Docker containers, images, and status monitoring tools"
            },
            "git": {
                "description": "Version control, commit, and repo management tools"
            },
            "web": {
                "description": "Data fetching and page content analysis tools over the internet"
            },
            "weather": {
                "description": "Current weather and forecast information via wttr.in"
            },
            "ollama": {
                "description": "Local Ollama model listing and management utilities"
            }
        },
        "actions": {
            "detail": "Inspect Details",
            "toggle": "Toggle Module",
            "uninstall": "Remove Module",
            "uninstall_check": "Are you sure you want to uninstall {name}?",
            "install": "Install New Module"
        },
        "empty": {
            "title": "No Modules Detected",
            "subtitle": "We couldn't find any MCP servers matching your criteria. Try adjusting your search or installing a new module.",
            "reset": "Clear Filters"
        },
        "labels": {
            "version": "v{version}",
            "author": "by {author}",
            "status": "System Status",
            "all_modules": "Modules"
        },
        "placeholders": {
            "empty": "No modules installed yet. Start by adding a new one."
        }
    },
    "placeholders": {
        "soon": {
            "title": "{tab} Coming Soon",
            "description": "We're meticulously crafting the '{tab}' ecosystem. This feature is currently in active development.",
            "button": "Notify Me"
        }
    }
};

export default marketplace;
