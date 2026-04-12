const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/main/services/extension/extension.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

const target = `        this.state.extensions.delete(extensionId);
        this.state.extensionConfigs.delete(extensionId);
        this.state.configListeners.delete(extensionId);
        this.logInfo(\`Extension uninstalled: \${extensionId}\`);
        this.emitStateChange('uninstalled', extensionId);`;

const replacement = `        // Delete from disk if it's in the managed extensions folder
        const extensionPath = instance.context.extensionPath;
        if (this.state.extensionsPath && extensionPath.startsWith(this.state.extensionsPath)) {
            try {
                const stats = fs.lstatSync(extensionPath);
                if (stats.isSymbolicLink()) {
                    fs.unlinkSync(extensionPath);
                } else {
                    fs.rmSync(extensionPath, { recursive: true, force: true });
                }
                this.logInfo(\`Extension folder deleted: \${extensionPath}\`);
            } catch (err) {
                this.logError(\`Failed to delete extension folder: \${extensionPath}\`, err);
            }
        }

        this.state.extensions.delete(extensionId);
        this.state.extensionConfigs.delete(extensionId);
        this.state.configListeners.delete(extensionId);
        this.logInfo(\`Extension uninstalled: \${extensionId}\`);
        this.emitStateChange('uninstalled', extensionId);`;

// Normalize line endings to LF for matching
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
    const newContent = normalizedContent.replace(normalizedTarget, replacement);
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('Successfully updated extension.service.ts');
} else {
    console.error('Target content not found! Content preview:');
    console.error(normalizedContent.substring(normalizedContent.indexOf('async uninstallExtension'), normalizedContent.indexOf('async activateExtension')));
    process.exit(1);
}
