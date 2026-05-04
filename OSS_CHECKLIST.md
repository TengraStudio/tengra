# OSS Readiness Checklist for Tengra

This document outlines the necessary steps to prepare the Tengra repository for Open Source Software (OSS) release, focusing on licensing, documentation, security, and community standards.

## 1. License Compliance Sweep
- [x] Ensure `LICENSE` file (GPL v3) is present in the root directory.
- [x] Verify all source files (`.ts`, `.tsx`, `.rs`) include the standard copyright header.
- [x] Audit third-party dependencies for license compatibility (avoiding non-commercial or restrictive licenses).
- [x] Generate a `NOTICE` or `CREDITS` file listing third-party attributions.

## 2. Documentation Hardening
- [x] Standardize `CONTRIBUTING.md` with coding styles and PR processes.
- [x] Consolidate architectural overview in `ARCHITECTURE.md`.
- [x] Create a comprehensive `ROADMAP.md` based on `TODO.md`.
- [x] Add "Getting Started" guide to `README.md` for external contributors.
- [x] Document the native infrastructure (`tengra-proxy` and `db-service`) in `src/native/README.md`.

## 3. Security & Privacy Audit
- [x] Ensure no hardcoded API keys or secrets in the codebase.
- [x] Verify `PathPolicy` enforcement for all filesystem tools.
- [x] Confirm `ExternalMcpPlugin` lifecycle is fully managed by the native proxy with resource limits.
- [x] Implement a `SECURITY.md` file with a vulnerability reporting process.
- [x] Audit telemetry and logging to ensure no Personally Identifiable Information (PII) is leaked.

## 4. CI/CD & Testing Stability
- [x] Stabilize integration tests for `db-service`.
- [/] Fix type-check errors in renderer tests (currently ~1100 errors due to path mismatches - In Progress).
- [ ] Verify build reproducibility for Windows, macOS, and Linux targets.
- [x] Set up automated GitHub Actions for PR validation (ci.yml, release.yml).

## 5. Community Readiness
- [x] Define a `CODE_OF_CONDUCT.md`.
- [x] Create Issue Templates (Bug Report, Feature Request, Documentation).
- [x] Create Pull Request Template with a mandatory testing checklist.
