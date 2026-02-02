# Contributing to Tandem

Thank you for your interest in contributing to Tandem! This document outlines the process for submitting code, reporting bugs, and suggesting improvements.

## Getting Started

1. **Fork the Repository**: Create a personal fork of the project.
2. **Clone your Fork**: `git clone https://github.com/your-username/tandem.git`
3. **Setup Environment**: Follow the [Development Guide](file:///c:/Users/agnes/Desktop/projects/tandem/docs/DEVELOPMENT.md) to set up your local environment.

## Development Workflow

### Branching Strategy
- `main`: Stable production-ready code.
- `develop`: Integration branch for new features.
- Feature branches: Created from `develop` using the format `feature/description` or `fix/description`.

### Pull Request (PR) Process
1. Create a new branch for your changes.
2. Implement your changes and add tests where applicable.
3. Ensure the build passes: `npm run build`.
4. Run linters and type checks: `npm run lint` and `npm run type-check`.
5. Submit a PR against the `develop` branch.
6. Provide a clear description of what changed and why.

## Coding Standards

- **Linting**: Follow the rules defined in `.eslintrc.json` and `.prettierrc`.
- **Naming**: Use camelCase for variables and functions, PascalCase for classes and components.
- **Documentation**: Use JSDoc for complex functions and provide Markdown documentation for major features in the `docs/` folder.
- **Rules**: Adhere to the project's [AI Rules](file:///c:/Users/agnes/Desktop/projects/tandem/docs/AI_RULES.md) (inspired by NASA's Power of Ten).

## Reporting Issues

- Use the GitHub Issue tracker.
- Use a clear and descriptive title.
- Provide a summary of the issue, steps to reproduce, and expected vs actual behavior.
- Include log samples from `logs/` if relevant (ensure sensitive data like tokens are removed).

## Community and Communication

- Focus on helping others and building a positive environment.
- Use professional and respectful language in all interactions.
- If you have questions, start a discussion in the repository's Discussion tab.

## License

By contributing to Tandem, you agree that your contributions will be licensed under the project's existing license.
