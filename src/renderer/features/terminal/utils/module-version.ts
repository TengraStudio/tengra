export type TerminalModuleVersion = {
    major: number;
    minor: number;
    patch: number;
};

export const TERMINAL_MODULE_VERSION: TerminalModuleVersion = Object.freeze({
    major: 2,
    minor: 0,
    patch: 0,
});

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

export function serializeTerminalModuleVersion(
    version: TerminalModuleVersion = TERMINAL_MODULE_VERSION
): string {
    return `${version.major}.${version.minor}.${version.patch}`;
}

export function isTerminalModuleVersionCompatible(candidate: string): boolean {
    const match = SEMVER_PATTERN.exec(candidate.trim());
    if (!match) {
        return false;
    }
    const major = Number(match[1]);
    return Number.isFinite(major) && major === TERMINAL_MODULE_VERSION.major;
}
