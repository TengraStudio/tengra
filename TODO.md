# Tengra Project TODOs

## Ollama Dependency Reduction
- [ ] Implement native Ed25519 key generation for Ollama authentication compatibility.
- [ ] Port the `ollama.com/connect` handshake natively into Tengra to bypass the external app requirement.
- [ ] Implement a built-in model runner using `llama-cpp-nodejs` to execute models directly.
- [ ] Migrate model download management from Ollama's API to a direct HuggingFace bridge.
- [ ] Support GGUF models directly via the built-in runner with optimized quantization settings.
- [ ] Move model health and resource monitoring (CPU/GPU usage) to the internal runner.
- [ ] Provide a migration utility for users to move existing Ollama models into Tengra-managed storage.
- [ ] Decommission Ollama-specific IPC handlers and connection management once the internal runner is stable.
- [ ] Implement a "Download from HF" UI for model discovery without needing the Ollama Marketplace.
- [ ] Implement auto-discovery and auto-configuration for internal model execution based on hardware (Metal/CUDA/Vulkan).

## General Project Maintenance
- [x] Fix ESLint parsing errors (Vite config and plugins are being parsed as JS instead of TS).
- [x] Resolve unused warnings in Rust `src/native` projects.
- [x] Optimize bundle size by refining `vite.config.ts` manual chunks.
- [x] Complete the migration of all provider credentials to the database.
- [x] Remove AuditLogService and all related infrastructure to reduce complexity.

## Native Services (src/native)
- [x] Address unused field warnings in `tengra-proxy`.
- [x] Address unused function warnings in `model_catalog.rs`.
