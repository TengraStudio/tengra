# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Architecture**: Complete refactor of the Renderer process architecture using React Contexts (`AuthContext`, `ModelContext`, `ChatContext`, `ProjectContext`).
- **Features**: 
    - Full "The Council" agent persona support.
    - Enhanced "Workspace Explorer" with easier file management and tree view.
    - "Audio Chat Overlay" for seamless voice interactions.
- **Documentation**: 
    - Comprehensive `PRD.md`, `ARCHITECTURE.md`, `USER_GUIDE.md`, and `DEVELOPER_GUIDE.md` added to `docs/`.
    - Professional standard files: `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`.
- **Testing**: Added integration tests for Proxy and Data services.

### Changed
- **Optimization**: Reduced prop drilling in `App.tsx` by ~90%.
- **UI/UX**: Improved `Sidebar` and `AppHeader` responsiveness and state management.
- **Performance**: Optimized chat streaming and rendering logic.

### Fixed
- Resolved issues with context menu z-indexing in Workspace Explorer.
- Fixed speech recognition state persistence.

## [0.1.0] - 2025-12-01

### Added
- Initial beta release.
- Basic chat functionality with Ollama support.
- Project file explorer.
- Settings management.
