# Testing Strategy

Tandem employs a multi-layered testing strategy to ensure stability across the main process, renderer process, and external microservices.

## Unit Testing

### Main Process
- **Framework**: Vitest.
- **Scope**: Individual services, utility functions, and business logic.
- **Standards**: Every new service must have a corresponding `.test.ts` file in `src/tests/main/services/`.
- **Mocking**: Use `vi.mock` for external dependencies like `electron`, `fs`, and `child_process`.

### Renderer Process (React Components)
- **Framework**: Vitest with React Testing Library.
- **Scope**: Component rendering, event handling, and state management.
- **Standards**: Focus on user-visible behavior rather than internal implementation details.

## Integration Testing

Integration tests verify the communication between different services and the interaction with the local database.

- **Database**: Use a dedicated test instance of PGlite or a temporary directory for file-based tests.
- **Service Hooks**: Verify that service lifecycles (init, start, stop) work correctly in sequence.

## End-to-End (E2E) Testing

- **Framework**: Playwright for Electron.
- **Scope**: Complete user flows (e.g., account linking, chat interaction, settings updates).
- **Execution**: Run with `npm run test:e2e`. These tests are mandatory before major releases.

## Microservice Testing

- **Go Proxy**: Tested using standard Go testing tools (`go test`). Focus on request routing and auth header injection.
- **Rust Token Service**: Tested using `cargo test`. Focus on token refresh logic and serialization.

## Continuous Integration (CI)

All tests are executed on every push to the `main` or `develop` branches.
- **Linting**: `npm run lint` must pass.
- **Type Checking**: `npm run type-check` must pass.
- **Build**: `npm run build` must successfully compile all assets.

## Best Practices

1. **Avoid Flakiness**: Use proper async/await and wait for specific DOM elements or event signals rather than using arbitrary timeouts.
2. **Deterministic Data**: Use factories or structured mocks for accounts and tokens to ensure tests are reproducible.
3. **Clean Up**: Ensure test files and database entries are removed after test execution to avoid side effects on subsequent runs.
