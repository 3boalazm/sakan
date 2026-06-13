# Sakan — J1 backend slice

Smallest working vertical slice of Sakan: the J1 flow running end-to-end, with the
state machine enforced in the backend and all data pair-scoped. Zero external
dependencies (uses Node's built-in `node:sqlite`).

## Run

    node --version        # needs Node 22+ (built-in node:sqlite)
    npm test              # runs the end-to-end J1 test (23 checks)
    npm start             # starts the API on http://127.0.0.1:8787 (persists to sakan.db)

## What works (J1)

Add Resource → Generate Summary → Add Questions → Answer (both) → Reveal → Create Decision → Confirm.

- **Pairing:** `POST /pair` (Mustafa, returns code) → `POST /pair/join` (Doaa). Two users only.
- **Pair-scoped:** every request resolves `pairId` from the token; foreign ids return 404; no token → 401.
- **State machine enforced:** an allow-list in `state_transitions` plus SQLite validator triggers reject any illegal transition; reveal/confirm cascades are executor logic in services.
- **Reveal rule:** a partner's answer is hidden until both answer (or force-reveal); responses lock after reveal.
- **Decision is the final output:** only two human confirmations produce `confirmed`, which is the only thing that completes a resource. AI has no path to decisions.

## What is stubbed (intentionally, for this slice)

- `src/ai.js` — `summarize` / `generateQuestions` are deterministic stubs. Replace with a server-side Arabic LLM call. AI stays generation-only.
- Sessions are in-memory opaque tokens. Production = Supabase Auth JWT carrying a `pair_id` claim.
- Storage is SQLite + app-layer pair scoping. Production = Postgres + RLS + composite FKs (see the Full Database Schema doc). The SQL is portable.

## Files

    src/db.js         schema + state_transitions allow-list + validator triggers
    src/ai.js         generation-only stubs (the LLM seam)
    src/services.js   pairing + J1 operations (transitions, reveal, decision)
    src/server.js     minimal HTTP API + token auth (pair_id from token)
    test/j1.mjs       end-to-end test (J1 + isolation + invalid transitions)
