# Engineering Reports

Generated artifacts for technical debt, dependency hygiene, and code metrics.

## Files

- `technical-debt-report.json`
- `technical-debt-report.md`
- `dependency-audit.json`
- `code-metrics.json`

## Generate

- `npm run metrics:debt`
- `npm run deps:audit:report`
- `npm run metrics:code`
- `npm run metrics:all`

## Notes

- Coverage values are read from `coverage/coverage-summary.json` if available.
- Dependency audit aggregates `npm outdated --json` and `depcheck --json`.
