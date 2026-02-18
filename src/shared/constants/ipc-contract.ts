/**
 * IPC contract compatibility metadata shared by renderer and main processes.
 *
 * Compatibility rule:
 * - Main contract version must be >= renderer minimum main version
 * - Renderer contract version must be >= main minimum renderer version
 */
export interface IpcContractVersionInfo {
    version: number;
    minRendererVersion: number;
    minMainVersion: number;
}

/** Current IPC contract schema version implemented by this build. */
export const IPC_CONTRACT_VERSION = 1;

/** Minimum renderer IPC contract version accepted by this main build. */
export const IPC_CONTRACT_MIN_RENDERER_VERSION = 1;

/** Minimum main IPC contract version required by this renderer build. */
export const IPC_CONTRACT_MIN_MAIN_VERSION = 1;

/**
 * Determines if a renderer build is compatible with a main-process IPC contract.
 */
export function isIpcContractCompatible(
    mainContract: IpcContractVersionInfo,
    rendererContractVersion: number = IPC_CONTRACT_VERSION,
    rendererMinMainVersion: number = IPC_CONTRACT_MIN_MAIN_VERSION
): boolean {
    return (
        mainContract.version >= rendererMinMainVersion
        && rendererContractVersion >= mainContract.minRendererVersion
    );
}

