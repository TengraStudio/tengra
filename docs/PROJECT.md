# Project Planning & Roadmap

This document outlines the Product Requirements Document (PRD), Roadmap, and strategic vision for Orbit.

---

## 1. Product Vision

**Orbit** is a premier desktop AI coding assistant that balances the power of cloud-based LLMs with the privacy of local model execution. It provides a unified, multi-provider interface to enhance developer productivity.

### Target Audience
- **Independent Developers**: Seeking a local-first, privacy-respecting AI tool.
- **Teams & Enterprises**: Needing unified access to multiple LLM providers (OpenAI, Anthropic, Gemini).
- **Power Users**: Utilizing autonomous agent councils for complex, multi-step coding tasks.

---

## 2. Core Features

| Feature             | Description                                                              | Status     |
| ------------------- | ------------------------------------------------------------------------ | ---------- |
| Multi-Model Chat    | Simultaneous conversations with OpenAI, Anthropic, Gemini, and Ollama.  | ✅ Stable  |
| Agent Council       | Specialized agents (Planner, Executor, Critic) for complex task execution. | ✅ Stable  |
| Privacy-First       | Local model execution via Ollama and on-device database persistence.    | ✅ Stable  |
| Extensible Backend  | Easy integration of new providers and tools via a service architecture. | ✅ Stable  |
| Semantic Memory     | Vector-based episodic and semantic memory for long-term context.        | ✅ Stable  |
| SSH & DevOps        | Secure remote server connections, file management, and Nginx wizards.   | ✅ Stable  |

---

## 3. Development Roadmap

### Phase 1: Core Stability (Completed)
- [x] Multi-provider IPC bridge.
- [x] Basic agent orchestration with tool usage.
- [x] Local database persistence with PGlite.
- [x] Responsive UI foundations with Tailwind CSS.

### Phase 2: Intelligence & Tools (Current)
- [x] Advanced collaboration strategies (Consensus, Chain-of-Thought).
- [x] Context-aware project indexing (RAG).
- [ ] Enhanced MCP (Model Context Protocol) tool integrations.
- [ ] Voice-to-Code capability.

### Phase 3: Ecosystem & Optimization (Future)
- [ ] Community plugin system for custom tools.
- [ ] Mobile companion app for remote monitoring.
- [ ] Performance analytics and cost tracking dashboard.

---

## 4. Gap Analysis

| Limitation                                  | Solution Path                                                    |
| ------------------------------------------- | ---------------------------------------------------------------- |
| High memory usage with multiple local models | Implement aggressive resource management in `MultiLLMOrchestrator`. |
| Initial setup complexity for local models  | Add a guided onboarding "Model Wizard".                          |
| Limited real-time collaboration            | Explore WebRTC for shared agent sessions.                        |
