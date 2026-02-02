# Project Planning and Roadmap

This document outlines the vision, current state, and future direction of Tandem. It serves as the primary reference for understanding our strategic goals and development progress.

## Product Vision

Tandem is designed to be the definitive desktop environment for AI-assisted coding. Our goal is to provide a seamless bridge between the raw power of cloud-based language models and the critical privacy requirements of professional software development. We aim to empower developers with high-autonomy agents that understand local context while respecting data sovereignty.

### Strategic Objectives
- **Privacy as a Default**: Every feature is built with a local-first mindset, ensuring that sensitive credentials and code never leave the user's machine unless explicitly intended.
- **Provider Agility**: Tandem provides a unified interface for all major LLM providers, allowing developers to switch models instantly based on performance, cost, or task suitability.
- **Agent Autonomy**: We are moving beyond simple chat interfaces toward autonomous agent "councils" that can plan, execute, and verify complex multi-file changes.

## Current Feature Status

### Multi-Model Interaction
Our core chat interface is fully stable and supports concurrent streams from OpenAI, Anthropic, Gemini, and local Ollama instances. This layer handles model-specific parameters and response streaming with high reliability.

### Agent Orchestration
The agent system is currently in a "stable" state, capable of executing multi-step tasks using a defined set of tools. Features like the Planner and Executor agents are operational and integrated with the local filesystem and terminal.

### Secure Synchronization
We have recently completed a major architectural shift to a bidirectional, HTTP-based token synchronization model. This has eliminated the risks associated with file-based credential storage and significantly improved the stability of our background services.

### Semantic Context and Memory
The application successfully utilizes vector-based memory to provide agents with relevant project context. This allows for more accurate code suggestions and better understanding of large, existing codebases.

## Development Roadmap

### Completed Milestones
- Established the multi-process Electron architecture and secure IPC bridge.
- Integrated PGlite for robust, relational data persistence directly in the application.
- Developed the Go-based proxy for high-performance routing and authentication.
- Implemented the Rust-based token monitoring service for seamless background refreshes.

### Current Priorities
- **Refinement of Agent Tools**: Improving the precision and safety of tools available to agents.
- **Resource Management**: Optimizing memory and CPU usage when running multiple local models simultaneously.
- **Advanced Context Retrieval**: Enhancing our RAG (Retrieval-Augmented Generation) implementation to handle deeper semantic relationships in code.

### Future Initiatives
- **Plugin Ecosystem**: Developing a framework that allows users to create and share custom tools and agent personas.
- **Performance Analytics**: Adding a detailed dashboard for tracking token usage, costs, and model performance metrics.
- **Collaborative Sessions**: Exploring ways to allow multiple users or agents to work together on the same project in real-time.

## Ongoing Challenges and Solutions

- **Resource Constraints**: Running powerful LLMs locally is demanding. We are implementing more aggressive model offloading and resource scheduling in our orchestration layer.
- **Configuration Complexity**: To simplify the initial setup, we are developing a guided "onboarding wizard" that helps users configure their API keys and local model environments.
- **Real-time Synchronization**: As we move toward more distributed components, ensuring that every service has the latest state without introducing latency remains a key focus.

