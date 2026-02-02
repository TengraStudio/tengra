# Technology Stack

Tandem is built on a polyglot architecture designed for high performance, security, and extensibility. We choose our tools based on their ability to solve specific domain problems effectively while maintaining a cohesive system.

## Core Runtime

### Electron
Electron serves as our primary application container. It allows us to combine the power of Node.js for low-level system interactions with the flexibility of Chromium for the user interface. By using Electron, we can maintain a single codebase for a cross-platform desktop experience.

### Node.js
Node.js powers the Main process and our extensive service layer. Its asynchronous, event-driven architecture is ideal for handling concurrent I/O operations, such as managing IPC calls, database transactions, and microservice orchestration.

## Frontend Architecture

### React and TypeScript
We use React for building a modular and reactive user interface. TypeScript is enforced across the entire codebase to provide compile-time safety, which is critical when handling complex state transitions and deep object structures common in AI applications.

### Vanilla CSS and Framer Motion
While we use some utility classes, we prioritize Vanilla CSS for core design tokens to maintain maximum control over the visual output. Framer Motion is our choice for animations because of its declarative syntax and orchestration capabilities, allowing us to create high-end effects like 3D rotations and spring-based physics.

### Monaco Editor
To provide a code editing experience that feels native to developers, we integrate the Monaco Editor. This gives us access to advanced features like syntax highlighting, IntelliSense, and diff views without reinventing the wheel.

## Specialized Microservices

Tandem offloads specific tasks to independent microservices built with systems-level languages. This isolation prevents the Main process from becoming a bottleneck and allows for easier scaling of intensive tasks.

### Rust Microservices (Axum and Tokio)
Our Rust services handle computationally heavy or sensitive tasks. Rust was chosen for its memory safety and high concurrency performance.
- **Token Service**: Handles the lifecycle and monitoring of OAuth tokens. By running this in Rust, we ensure that background refresh tasks are extremely efficient and have a minimal resource footprint.
- **Quota and Memory Services**: These services manage complex data aggregations and vector-based operations. Using Rust allows us to perform these operations with predictable latency.

### Go Proxy (CLIProxy-Embed)
The Go proxy acts as our gateway to external LLM providers. Go was selected for its excellent networking primitives and fast execution. It manages request routing, authentication header injection, and response streaming with very low overhead.

## Data and Persistence

### PGlite
We use PGlite, a WASM-based build of PostgreSQL, for our primary data store. Unlike SQLite, PGlite gives us the full power of a relational database—including advanced types and indexing—directly within the Node.js process. This eliminates the need for an external database installation while providing a robust, ACID-compliant storage layer.

### Vector Storage
For semantic search and long-term agent memory, we utilize vector extensions within our database. This allows the agent to retrieve relevant context from the user's workspace using embeddings.

## Communication Channels

### Inter-Process Communication (IPC)
Communication between the Renderer and Main processes is handled via a secure, context-isolated IPC bridge. We use typed wrappers to ensure that messages sent across the bridge are validated at both ends.

### Internal HTTP APIs
For communication between the Main process and microservices, we use lightweight HTTP APIs. This decoupled approach allows us to restart services independently and facilitates testing.

### Event Streaming
Server-Sent Events (SSE) and WebSockets are used for real-time streaming of AI responses, ensuring the UI feels responsive as the agent generates text.

