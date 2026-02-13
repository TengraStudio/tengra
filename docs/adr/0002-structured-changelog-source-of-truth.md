# ADR 0002: Structured Changelog as Single Source of Truth

- Status: accepted
- Date: 2026-02-13
- Owners: Product Engineering

## Context

Manual markdown editing caused translation drift and inconsistent release notes across locales.

## Decision

Adopt `docs/changelog/data/changelog.entries.json` as canonical source and generate locale markdown artifacts from it.

## Alternatives Considered

1. Keep per-locale markdown files as source
2. Use external CMS for release notes

## Consequences

Positive:
- Deterministic generation and validation.
- Easier localization quality gates.
- Better integration with commit-to-changelog automation.

Negative:
- Requires generation pipeline before publishing.
- Contributors must learn structured entry format.

## Rejected Alternatives

- Per-locale markdown source rejected due to synchronization cost.
- External CMS rejected due to operational complexity and offline workflow requirements.
