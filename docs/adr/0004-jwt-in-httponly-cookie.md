# 0004 — JWT in httpOnly cookie (not localStorage)

**Status:** Accepted
**Date:** 2025-09 (retroactive)

## Context

We need to authenticate the SPA against the API on every request. The two common patterns:

1. **JWT in `localStorage`**, attached to requests as `Authorization: Bearer <token>`.
2. **JWT in `httpOnly` + `Secure` + `SameSite=Lax` cookie**, attached automatically by the browser; CSRF guarded by SameSite.

`localStorage` is convenient (any `fetch` works without `credentials`) but readable by any script that runs on the page — XSS in *any* third-party dependency leaks the token. Cookies with `httpOnly` aren't readable by JS at all; the worst an XSS payload can do is hit the API as the user (limited by SameSite + same-origin) without exfiltrating the token.

The product hosts user-uploaded content (athlete photos, news with rich text) — a path where a stored XSS bug is realistic. The threat model favours cookie storage.

## Decision

Store the JWT in an **`httpOnly` + `Secure` + `SameSite=Lax`** cookie named `access_token`. The web app makes API calls with `credentials: 'include'`. CORS is locked to the explicit list of frontend origins; no wildcards.

## Consequences

Positive:
- Stored XSS can't exfiltrate the token (httpOnly).
- Token is automatically sent on same-origin requests; no `Authorization` header bookkeeping in the web client.
- `Secure` flag forces HTTPS in production; `SameSite=Lax` blocks cross-site CSRF on POST.

Negative:
- All API calls from the web must include `credentials: 'include'` — easy to forget on a new endpoint, where a missing flag silently makes the request unauthenticated.
- CORS must be tighter: cookies require explicit origin, not `*`. We enforce this in `apps/api/src/main.ts → buildCorsOrigins()` (PR #89).
- Revoking a token is harder — there's no client-side state to clear; the server has to track invalidated tokens or wait for short access-token TTL.
- WebSocket auth needs a parallel mechanism; the events gateway accepts the token via the Socket.io handshake `auth.token` field rather than a cookie.

Hard rules:
- Cookie options: `{ httpOnly: true, secure: NODE_ENV === 'production', sameSite: 'lax' }`. Defined in `apps/api/src/auth/auth.controller.ts → COOKIE_OPTIONS`.
- Access-token TTL: 15 minutes; refresh-token TTL: 7 days. Refresh flow renews the cookie.
- All web `fetch` / `axios` calls use `credentials: 'include'`.
- No `Authorization: Bearer` parsing for the web SPA — only for programmatic / API clients (Swagger, future CLI).

## References

- `apps/api/src/auth/auth.controller.ts` — cookie issuance.
- `apps/web/src/lib/api.ts` — Axios `withCredentials: true`.
- `docs/07-SECURITY-AND-AUTH.md`.
- OWASP Cheat Sheet: "Storing JWTs" (2024).
