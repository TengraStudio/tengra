const WINDOWS_CMD_SHIMS = new Set(['npm', 'npx', 'pnpm', 'yarn']);

export function resolveWindowsCommand(command: string): string {
    if (process.platform !== 'win32') {
        return command;
    }

    const normalized = command.trim().toLowerCase();
    if (!normalized) {
        return command;
    }

    if (normalized.endsWith('.exe') || normalized.endsWith('.cmd') || normalized.endsWith('.bat')) {
        return command;
    }

    if (WINDOWS_CMD_SHIMS.has(normalized)) {
        return `${command}.cmd`;
    }

    return command;
}
