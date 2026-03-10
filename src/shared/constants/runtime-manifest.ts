export const RUNTIME_PLATFORM_VALUES = ['win32', 'darwin', 'linux'] as const;
export const RUNTIME_ARCH_VALUES = ['x64', 'arm64'] as const;
export const RUNTIME_COMPONENT_SOURCE_VALUES = ['managed', 'external'] as const;
export const RUNTIME_COMPONENT_REQUIREMENT_VALUES = ['required', 'optional', 'user-managed'] as const;
export const RUNTIME_COMPONENT_KIND_VALUES = ['service', 'runtime', 'tool'] as const;
export const RUNTIME_ARCHIVE_FORMAT_VALUES = ['raw', 'zip', 'tar.gz'] as const;
export const RUNTIME_INSTALL_SUBDIRECTORY_VALUES = ['bin', 'models', 'temp'] as const;
