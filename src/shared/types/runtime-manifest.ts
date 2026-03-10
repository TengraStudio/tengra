import type {
    RUNTIME_ARCH_VALUES,
    RUNTIME_ARCHIVE_FORMAT_VALUES,
    RUNTIME_COMPONENT_KIND_VALUES,
    RUNTIME_COMPONENT_REQUIREMENT_VALUES,
    RUNTIME_COMPONENT_SOURCE_VALUES,
    RUNTIME_INSTALL_SUBDIRECTORY_VALUES,
    RUNTIME_PLATFORM_VALUES,
} from '@shared/constants/runtime-manifest';

export type RuntimePlatform = typeof RUNTIME_PLATFORM_VALUES[number];
export type RuntimeArch = typeof RUNTIME_ARCH_VALUES[number];
export type RuntimeComponentSource = typeof RUNTIME_COMPONENT_SOURCE_VALUES[number];
export type RuntimeComponentRequirement = typeof RUNTIME_COMPONENT_REQUIREMENT_VALUES[number];
export type RuntimeComponentKind = typeof RUNTIME_COMPONENT_KIND_VALUES[number];
export type RuntimeArchiveFormat = typeof RUNTIME_ARCHIVE_FORMAT_VALUES[number];
export type RuntimeInstallSubdirectory = typeof RUNTIME_INSTALL_SUBDIRECTORY_VALUES[number];

export interface RuntimeTargetEnvironment {
    platform: RuntimePlatform;
    arch: RuntimeArch;
}

export interface RuntimeManifestTarget {
    platform: RuntimePlatform;
    arch: RuntimeArch;
    assetName: string;
    downloadUrl: string;
    archiveFormat: RuntimeArchiveFormat;
    sha256: string;
    executableRelativePath: string;
    installSubdirectory: RuntimeInstallSubdirectory;
    sizeBytes?: number;
}

export interface RuntimeManifestComponent {
    id: string;
    displayName: string;
    version: string;
    kind: RuntimeComponentKind;
    source: RuntimeComponentSource;
    requirement: RuntimeComponentRequirement;
    description?: string;
    installUrl?: string;
    targets: RuntimeManifestTarget[];
}

export interface RuntimeManifest {
    schemaVersion: 1;
    releaseTag: string;
    generatedAt: string;
    components: RuntimeManifestComponent[];
}

export type RuntimeBootstrapPlanEntryStatus = 'ready' | 'install' | 'external' | 'unsupported';

export interface RuntimeBootstrapPlanEntry {
    componentId: string;
    displayName: string;
    version: string;
    status: RuntimeBootstrapPlanEntryStatus;
    source: RuntimeComponentSource;
    requirement: RuntimeComponentRequirement;
    reason: 'file-present' | 'missing-file' | 'external-dependency' | 'unsupported-platform';
    installPath?: string;
    installUrl?: string;
    target?: RuntimeManifestTarget;
}

export interface RuntimeBootstrapPlanSummary {
    ready: number;
    install: number;
    external: number;
    unsupported: number;
}

export interface RuntimeBootstrapPlan {
    manifestVersion: string;
    environment: RuntimeTargetEnvironment;
    entries: RuntimeBootstrapPlanEntry[];
    summary: RuntimeBootstrapPlanSummary;
}
