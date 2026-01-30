# Agent Engineering

This document details the architecture and implementation of the AI agents within Tandem.

## Agent Architecture

Tandem uses a multi-layered agent architecture designed for high autonomy and reliability.

### 1. Decision Engine
The agents are powered by state-of-the-art LLMs (Anthropic, Gemini, OpenAI) accessed via a unified proxy layer. The decision-making process follows a "think-before-act" pattern, where the agent generates an internal monologue before emitting tool calls.

### 2. Tool-Calling Mechanism
Agents interact with the system through a controlled set of tools. 
- **Tool Discovery**: Available tools are defined in the service layer and exposed to the agent via IPC.
- **Validation**: Every tool call is validated for type safety and permission level before execution.
- **Execution**: Tools can range from simple file reads to complex multi-step build commands.

### 3. Context Window Management
To maintain performance and relevance:
- **Pruning**: Redundant or outdated information is removed from the conversation history.
- **Summarization**: Long interaction chains are summarized to preserve the core intent without exceeding token limits.
- **RAG (Retrieval-Augmented Generation)**: relevant codebase snippets are injected into the context based on semantic search.

## Interaction with Microservices

Agents rely on internal microservices for specialized tasks:

- **Go Proxy**: Handles secure external API communication and credential management.
- **Rust Token Service**: Ensures tokens are fresh and monitored, allowing the agent to perform long-running background tasks without auth interruptions.

## Agent Personas

Personas are defined in `src/shared/types/agent.ts` and managed through the `AgentService`.
- **Architect**: Focuses on project structure and design patterns.
- **Coder**: Specialized in high-throughput code generation and refactoring.
- **Debugger**: Expert in log analysis and root cause identification.

## Safety and Control

- **Pre-execution Approval**: Critical actions (e.g., deleting files, pushing commits) require explicit user approval.
- **Sandbox Environment**: Native commands are executed in a monitored shell environment to prevent unauthorized system access.
- **Audit Logging**: Every action taken by an agent is recorded in the system logs for post-hoc review.

## Future Roadmap

- **Multi-Agent Collaboration**: Enabling multiple agents to work on separate components of a task simultaneously.
- **Self-Correction**: Improved loops for agents to automatically fix build or lint errors they introduce.
- **Custom tool creation**: Allowing developers to define project-specific tools that agents can learn and use.
