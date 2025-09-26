Model Decision — Generate and Run Tests

Scenario: When changing or adding any `src/services/*` or `src/agents/*`, generate unit tests and run them locally.

Guidance:
- Prefer small, focused tests that mock external calls.
- For HTTP endpoints, use `supertest` and verify 2xx/4xx flows.
- Include a package.json script update if missing.

Acceptance:
- CI step `npm test` passes and new tests cover primary flows.

