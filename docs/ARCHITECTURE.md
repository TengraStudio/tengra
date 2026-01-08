# System Architecture

## Overview

Orbit is built as a desktop application using **Electron**, leveraging modern web technologies for the frontend and a robust Node.js environment for the backend processes. The architecture follows a clear separation of concerns between the Renderer (UI) and the Main (System & Logic) processes, communicating via a secure Inter-Process Communication (IPC) bridge.

## High-Level Diagram

```mermaid
graph TD
    User[UserId] --> Renderer[Renderer Process (React)]
    Renderer -->|IPC Bridge| Main[Main Process (Node.js)]
    
    subgraph Main Process
        Main --> Services[Service Layer]
        Services --> Proxy[Proxy Service]
        Services --> LLM[LLM Service (Ollama/OpenAI)]
        Services --> DB[Database Service (SQLite)]
        Services --> FS[File System Service]
        Services --> SSH[SSH Service]
    end
    
    subgraph External
        Proxy --> CloudAPI[Cloud APIs (Antigravity/OpenAI)]
        LLM --> LocalModel[Local Ollama Instance]
        SSH --> RemoteServer[Remote Server]
    end
    
    subgraph Storage
        DB --> LocalDB[(Local SQLite DB)]
        FS --> LocalFiles[Local File System]
    end
```

## Component Breakdown

### 1. Renderer Process (Frontend)
The user interface is built with **React**, **TypeScript**, and **Tailwind CSS**. It is designed to be highly responsive and modular.

*   **ViewManager**: The central router that handles switching between Chat, Projects, Council, and Settings views.
*   **Context API**: State is managed globally using React Contexts (`AuthContext`, `ModelContext`, `ChatContext`, `ProjectContext`) to avoid prop drilling and ensure data consistency.
*   **Features**: Logic is grouped by feature folders (e.g., `features/chat`, `features/projects`) which contain their own hooks, components, and utilities.

### 2. Main Process (Backend)
The heavy lifting is done in the Electron Main process. It manages the application lifecycle, native integrations, and long-running tasks.

*   **Service Layer**: A collection of singleton services instantiated at startup using a Dependency Injection pattern.
    *   **DatabaseService**: Manages the local SQLite database for storing chats, messages, and settings.
    *   **OllamaService**: Handles communication with the local Ollama instance.
    *   **ProxyService**: Manages authentication and request routing to the Antigravity cloud proxy.
    *   **FileSystemService**: Provides safe abstractions for file operations.
    *   **SSHService**: Manages secure connections to remote servers.

### 3. IPC Bridge
Communication between the Renderer and Main processes is handled via a strictly typed `window.electron` API. This API exposes specific methods (e.g., `db.getAllChats()`, `llm.generate()`) rather than allowing arbitrary remote execution, ensuring security.

## Data Flow

1.  **User Action**: The user types a message in the `ChatInput` component.
2.  **State Update**: The `ChatContext` updates the local state to show the user's message immediately.
3.  **Persistence**: A call is made via IPC to `db.addMessage()` to save the user message to the local database.
4.  **Inference Request**: The `useChatManager` hook triggers a generation request.
    *   If **Local**: The `OllamaService` streams tokens back from the local model.
    *   If **Cloud**: The `ProxyService` forwards the request to the upstream API.
5.  **Streaming**: Response chunks are streamed back to the Renderer via IPC events, updating the UI in real-time.
6.  **Finalization**: Once generation is complete, the final message is saved to the database.

## Security Considerations

*   **Content Isolation**: Context isolation is enabled in Electron to prevent renderer code from accessing node internals directly.
*   **Secrets Management**: API keys and tokens are stored securely in the user's encrypted local store or handled via the OS keychain where applicable.
*   **Proxy Authentication**: Cloud requests are signed and authenticated via the Proxy Service to ensure specialized access control.
