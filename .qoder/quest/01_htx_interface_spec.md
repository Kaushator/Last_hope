HTX Interface — Spec

Goal
- Read-only HTX analytics interface with Fernet-based secret handling and Excel report parsing. Expose REST endpoints for later integration.

Scope
- Fernet decryptor (Node or Python-assisted) for API key/secret.
- HTX client wrapper (market symbols, tickers, candles, balance [read-only]).
- Excel (XLSX) parser for HTX exports: trades, deposits/withdrawals, fees → canonical JSON.
- Endpoints under `/htx/*` with error normalization.

Endpoints
- POST `/htx/keys/test` → decrypt and perform a lightweight auth check; respond with `{ ok: true }` or `{ error }`.
- GET `/htx/markets` → symbols/tickers snapshot.
- GET `/htx/candles?symbol=&interval=&limit=` → OHLCV list.
- POST `/htx/report/upload` → multipart XLSX, returns parsed summary JSON.

Acceptance
- Unit tests for decryptor and parser; integration tests for endpoints with mocked HTX.
- No plaintext secrets; `.env` or encrypted files only.

Plan (High-Level)
1) `src/services/fernet.js` (Node variant) with tests; parity with `tools/encrypt_api_key.py`.
2) `src/services/htxClient.js` with fetch + rate limit; return normalized JSON.
3) `src/services/htxExcelParser.js` using `xlsx` lib; fixtures and tests.
4) Wire routes in `server.js`; add `supertest` tests.
5) Add Qoder tasks into `src/agents/htxAgent.js`.

