# Renderer MCP Settings Tab Performance Budget

## Budget Targets
- Interaction/update budget: <= 250ms
- Heavy path budget: <= 900ms
- Budget exceedance should increment health counters.

## Regression Policy
- Any sustained budget exceedance (>5 in a row) is treated as release blocker.
- CI must run renderer test coverage for edge + integration paths.

## Measurement Sources
- Component health store timings (lastDurationMs, vgDurationMs)
- Integration tests on critical user flows
