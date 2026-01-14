# Project Planning & Strategy

This document outlines the Product Requirements Document (PRD), Roadmap, and current TODO list for Orbit.

---

## 1. Product Requirements (PRD)

### Goal
Orbit aims to be the premier desktop AI coding assistant, balancing power (through cloud models) and privacy (through local models).

### Target Audience
- Software developers who want local-first AI.
- Teams needing unified access to multiple LLM providers.
- Power users who utilize autonomous agents for complex tasks.

### Core Features
- **Multi-Model Support**: OpenAI, Anthropic, Gemini, Ollama, etc.
- **Agent Council**: Specialized agents for planning, building, and reviewing code.
- **Privacy-First**: Local model execution and local-only data storage option.
- **Extensible Architecture**: Easy integration of new providers and tools.

---

## 2. Roadmap

### Phase 1: Core Stability (Current)
- [x] Multi-provider IPC bridge.
- [x] Basic agent orchestration.
- [x] Local database persistence.
- [x] Responsive UI foundations.

### Phase 2: Intelligence & Tools
- [ ] Improved agent tool usage (Terminal, Search, Debugging).
- [ ] Advanced collaboration strategies (Consensus, Chain-of-Thought).
- [ ] Context-aware project indexing (RAG).

### Phase 3: Ecosystem & Optimization
- [ ] Plugin system for community tools.
- [ ] Mobile companion app.
- [ ] Performance analytics dashboard.

---

## 3. TODO List

### High Priority
- [ ] Implement `getDetailedStats` in DatabaseService (Fixed in recent session).
- [ ] Fix sidebar render loop (Fixed in recent session).
- [ ] Enhance terminal history persistence.

### Features
- [ ] Add support for Groq provider.
- [ ] Implement "Smart Context" for auto-selecting relevant code snippets.
- [ ] Add voice-to-code capability.

### Technical Debt
- [ ] Move all test files to a central `tests/` folder.
- [ ] Consolidate documentation (In progress).
- [ ] Remove unused dependencies.

---

## 4. Gap Analysis

- **Current Limitation**: High memory usage when running multiple local models.
- **Solution Path**: Implement more aggressive resource management in `MultiLLMOrchestrator`.
- **Current Limitation**: Initial setup complexity for local models.
- **Solution Path**: Add a guided onboarding "Model Wizard".
