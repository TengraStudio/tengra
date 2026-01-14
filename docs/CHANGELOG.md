# Changelog & Updates

Track the evolution of Orbit.

---

## Recent Updates

### 2026-01-15: Stats & Performance
- **DatabaseService**: Implemented `getDetailedStats` and fixed `getTimeStats` to populate the Statistics tab correctly.
- **Sidebar**: Fixed infinite render loop by memoizing `ChatItem` and `FolderSection`.
- **Chat**: Resolved "placeholder ghosting" when API generation fails.
- **Docs**: Consolidated 19 markdown files into 6 themed documents.

### 2026-01-14: Build Improvements
- **Build**: Fixed TypeScript errors related to unused variables and incorrect return types.
- **IPC**: Standardized `onStreamChunk` return types.

---

## Version History

### v1.1.0: Multi-LLM Support
- Added `MultiLLMOrchestrator` for concurrent model execution.
- Introduced Model Collaboration strategies.
- Switched to PGlite for better local performance.

### v1.0.0: Initial Release
- Basic chat functionality with OpenAI and Anthropic.
- Local Ollama support.
- Project management view.
- Theme support (Dark/Light).
