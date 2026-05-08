/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const RUNTIME_PLATFORM_VALUES = ['win32', 'darwin', 'linux', 'aix', 'freebsd', 'openbsd', 'sunos'] as const;
export const RUNTIME_ARCH_VALUES = ['x64', 'arm64'] as const;
export const RUNTIME_COMPONENT_SOURCE_VALUES = ['managed', 'external'] as const;
export const RUNTIME_COMPONENT_REQUIREMENT_VALUES = ['required', 'optional', 'user-managed'] as const;
export const RUNTIME_COMPONENT_KIND_VALUES = ['service', 'runtime', 'tool'] as const;
export const RUNTIME_ARCHIVE_FORMAT_VALUES = ['raw', 'zip', 'tar.gz', 'gz'] as const;
export const RUNTIME_INSTALL_SUBDIRECTORY_VALUES = ['bin', 'models', 'temp'] as const;

