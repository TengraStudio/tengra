/**
 * Hello World Extension for Tengra
 */

export interface ExtensionContext {
    extensionId: string;
    subscriptions: { dispose(): void }[];
    logger: {
        info(message: string): void;
    };
}

/**
 * This function is called when the extension is activated.
 * Activation events are defined in package.json.
 */
export async function activate(context: ExtensionContext) {
    context.logger.info('Hello World extension is now active!');

    // Example of adding a subscription for cleanup
    const disposable = {
        dispose: () => {
            context.logger.info('Cleaning up Hello World resources...');
        }
    };
    context.subscriptions.push(disposable);
}

/**
 * This function is called when the extension is deactivated.
 */
export function deactivate() {
    // Perform any final cleanup here
}
