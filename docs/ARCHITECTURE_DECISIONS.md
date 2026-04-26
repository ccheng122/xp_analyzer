# Architecture Decisions

Append-only log of non-obvious tradeoffs. Each entry uses the template at the bottom of this file.

---

## In-memory experiment store for `/experiment/[id]`
**Date:** 2026-04-26
**Status:** Accepted
**Context:** Pulling Results out of the wizard flow into its own route (`/experiment/[id]`) means the new route needs to read the experiment result from somewhere. There is no backend that persists experiments, and `ReportViewV2` requires a live `File` object (`csvFile` prop) so the chat panel can re-POST the CSV to `/api/chat` for subgroup follow-up questions. A `File` cannot be JSON-serialized.
**Decision:** Add a module-scope `Map<string, { result, config, csvFile }>` in `lib/experimentStore.ts` with `set(id, …)` / `get(id)`. The wizard writes to it before navigating; the route reads from it on mount.
**Alternatives considered:**
- **sessionStorage / localStorage.** Rejected because the `File` can't be serialized — chat would silently break after navigation. Would have required a refresh-survival path that we don't need.
- **URL query params with a serialized result.** Rejected: realistic experiment results (with subgroup breakdowns) easily exceed URL length limits, and history/back-button get noisy.
- **Real backend persistence.** Out of scope for this refactor; this is a local analysis tool, not a multi-user app.
**Consequences:**
- Hard-refreshing `/experiment/[id]` loses the data. The route shows an empty state explaining this and linking back to `/`.
- Closing the tab loses all experiments — there is no history.
- Sharing an `/experiment/[id]` URL with another user (or the same user in a different tab) does nothing useful.
- If we ever add real persistence, the store interface (`set`/`get`) is the cut point — the call sites stay the same.

## Wizard state reset on submit
**Date:** 2026-04-26
**Status:** Accepted
**Context:** With Results moving to its own route, the user can navigate back to `/` after viewing an experiment. Without intervention, `WizardShell`'s `useState` would still hold the previous run's CSV, config, and step. We had to choose between resetting on submit or preserving state for tweak-and-rerun.
**Decision:** Reset `WizardState` to its initial values at the same moment we generate the experiment id and `router.push` to `/experiment/[id]`. Returning to `/` always lands on a fresh wizard at step 1.
**Alternatives considered:**
- **Preserve state across navigation.** Rejected: a new experiment almost always means a new CSV. The retained `File` reference would be stale (or, if the user re-uploaded, would briefly desync from the rest of the config), and the cognitive cost of "wait, why are my old metrics here?" outweighs the convenience of editing a previous config.
**Consequences:**
- "Edit and re-run with one tweak" is not a one-click flow; users re-upload the CSV and re-enter config each time.
- Users hitting the browser back button from `/experiment/[id]` to `/` will not see their previous wizard state. This may surprise users who expect back-button to undo navigation rather than start a new flow.
- If iterative experimentation becomes a real use case later, we'd add a "Clone this run" button on the results page that pre-fills the wizard, rather than reverse this decision.

## `crypto.randomUUID()` for experiment ids
**Date:** 2026-04-26
**Status:** Accepted
**Context:** `/experiment/[id]` needs ids, but there is no backend to assign them. Whatever the wizard puts in the URL is what the route reads.
**Decision:** Generate ids with `crypto.randomUUID()` in the wizard, immediately before writing to the store and navigating.
**Alternatives considered:**
- **Server-assigned ids.** No server in this layer to assign them.
- **Slugifying the experiment name.** Rejected: collisions when the user runs the same experiment twice; also leaks experiment names into URLs.
- **Monotonic counter.** Rejected: requires module-level mutable state that can race across navigations and is tab-scoped anyway.
**Consequences:**
- URLs are opaque (`/experiment/3a8f…`), not human-meaningful. Acceptable for a tool with no sharing model.
- `crypto.randomUUID()` requires a secure context (HTTPS or localhost). Both apply for our use cases.
- If we ever add backend persistence with its own id strategy (incremental, ULID, etc.), we change the generator in one place.

## Prefer `VERCEL_PROJECT_PRODUCTION_URL` over `VERCEL_URL` for internal subgroup calls
**Date:** 2026-04-26
**Status:** Accepted
**Context:** The chat route (`app/api/chat/route.ts`) is a Next.js function that, when Claude calls the `run_subgroup_analysis` tool, fetches the co-deployed Python `/api/subgroup` function over HTTPS. Originally that fetch built its URL from `process.env.VERCEL_URL` — the deployment-specific hostname (e.g. `web-aihngz0v8-…vercel.app`). With Vercel Deployment Protection enabled on the project, that hostname returns 401 + an HTML auth page to internal function-to-function fetches. The chat route's tool handler couldn't parse the HTML as JSON, returned a generic error, and Claude rendered it as "authentication error" to the user. Discovered when day-of-week chat queries failed silently in production after the V2 cutover.
**Decision:** Change `getSubgroupUrl()` to prefer `VERCEL_PROJECT_PRODUCTION_URL` (Vercel-provided env var that always resolves to the production alias, e.g. `web-wine-one-64.vercel.app`) over `VERCEL_URL`. The production alias is unprotected, so internal fetches succeed.
**Alternatives considered:**
- **`VERCEL_AUTOMATION_BYPASS_SECRET` header.** The Vercel-recommended pattern for exactly this case. Rejected for now: requires generating a secret in Vercel settings + threading a header through the fetch. Strictly correct for multi-environment setups, but heavier than needed today.
- **Disable Deployment Protection entirely.** Rejected: would also expose preview URLs publicly, eroding the modest safety net Vercel provides for branch deploys. We may turn it off later if previews don't matter at all, but not as part of this fix.
- **Restructure to call the subgroup logic in-process.** Rejected: subgroup is a Python function, chat route is TypeScript — no shared address space. Would require porting the pandas groupby logic to JS, big scope.
**Consequences:**
- **Cross-environment leak risk.** `VERCEL_PROJECT_PRODUCTION_URL` is set even on preview deployments, so a preview's chat function would call **production**'s subgroup function. Today there are no previews, so the leak is theoretical — but the moment we deploy a preview branch, queries against test data on the preview would hit the wrong CSV. Switch to bypass-secret (Alternative 1) before relying on previews.
- **Single point of routing.** All chat tool calls now flow through one hostname; if the production alias is rotated or temporarily unhealthy, chat fails everywhere.
- **`VERCEL_URL` fallback retained** as a defense for environments where `VERCEL_PROJECT_PRODUCTION_URL` is somehow absent (forks, custom Vercel configurations).

## No route-level test for `/experiment/[id]`
**Date:** 2026-04-26
**Status:** Accepted
**Context:** The new route is a thin client component that reads from an in-memory store and renders `ReportViewV2`. Testing it meaningfully would mean exercising real Next.js navigation (router.push from the wizard, client-side hydration on the new page), which our current vitest+jsdom setup does not do well.
**Decision:** Cover the store with a unit test (`lib/__tests__/experimentStore.test.ts`) for the set/get round-trip. Skip writing a route-level test for `/experiment/[id]` itself. Manual smoke test (run an experiment end-to-end, confirm it lands on `/experiment/[uuid]` with the right data and back-link) is the verification path.
**Alternatives considered:**
- **Full route test with a test renderer + mocked router.** Rejected for now: high mock-to-assertion ratio for low signal. The interesting logic is in the store and in `ReportViewV2`, both already tested.
- **Playwright/E2E.** Out of scope for this refactor — would require adding a new test runner.
**Consequences:**
- Regressions in route wiring (params unwrapping, store lookup, empty state for unknown id) would only be caught by manual click-through.
- If E2E tests get added later, this route is the natural first candidate.

---

## Template

```
## [Decision title]
**Date:** YYYY-MM-DD
**Status:** Accepted
**Context:** What problem we were solving.
**Decision:** What we chose.
**Alternatives considered:** What we didn't choose, and why.
**Consequences:** What this means in practice — including the things that will feel surprising or broken later.
```
