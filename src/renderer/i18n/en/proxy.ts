const sectionData = {
    "title": "Nginx Reverse Proxy Setup",
    "subtitle": "Expose your backend app on a domain with minimal setup.",
    "domain": "Domain",
    "port": "Internal Port",
    "preview": "Preview config",
    "apply": "Apply & Reload Nginx",
    "configPreview": "Configuration Preview",
    "placeholders": {
        "domain": "api.myapp.com",
        "port": "3000"
    },
    "status": {
        "domainRequired": "Domain is required",
        "connecting": "Connecting to server...",
        "moving": "Moving configuration to the Nginx directory...",
        "success": "Nginx was reloaded successfully!",
        "error": "Couldn't apply the configuration: {{error}}. Make sure you have sudo privileges."
    }
};

export default sectionData;
