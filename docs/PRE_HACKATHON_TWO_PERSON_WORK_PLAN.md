# Pre-hackathon review and two-person work plan

Review date: 17 October 2026. Fix progress updated 18 October 2026. No Stellar implementation is included in this work.

Workstream owners: **Akif is Person A** (records and transaction reliability); **Yhlas is Person B** (public experience, scanner, QR/PDF, and accessibility). All A/B references below use this assignment.

## Reviewed baseline and results

- `main`: `74fb0fd`; the local checkout is now `fix/pre-hackathon-foundations`.
- `developer`: `e3df9c0`; adds the readiness/roadmap document only. Its application code is identical to `main`.
- `fix/pre-hackathon-foundations`: `fa12ad5`; four commits on top of `developer` add the proposed reliability changes.
- Fresh remote references were fetched before inspection. The original review used an isolated copy of `fa12ad5` in `/tmp`; the follow-up fixes are now being made directly on `fix/pre-hackathon-foundations`.
- Clean root `npm ci`, all 31 existing tests, production build (including TypeScript), post-build formatting, and dependency audit passed. The audit reported zero vulnerabilities at review time.
- Installation warns that this machine's Node 25 is outside Vitest 5's supported engine range. Standardize development on Node 22.22.2, matching the proposed CI, despite the tests passing here.
- The main production JS chunk is approximately 914 kB minified / 285 kB gzip. Treat load-time work as secondary to correctness.
- A real browser walkthrough was attempted but Chromium could not launch because the environment lacks `libnspr4.so`. Visual quality, real wallet interactions, and phone-camera behavior are not verified by this review.
- Temporary regression checks reproduce the lifecycle mapping mismatch and repair draft retention across different passport IDs. These checks are review artifacts in `/tmp`, not changes to the project test suite.

## Assessment of the suggested changes

Keep the foundations changes: one root lockfile, honest fixture provenance, object-type validation, safe URL protocols, explicit authorization-read errors, preserved transaction proof on readback failure, removal of fake evidence uploads, tests, and CI. They are useful preparation regardless of the future chain.

Integrate the foundations branch into `developer` through review before either person starts new work. Do not reimplement the completed fixes. Passing the suite is a baseline, not evidence that all workflows are correct.

### Follow-up status (18 October 2026)

The current branch now corrects the four reproduced review findings: lifecycle labels/codes, repair draft and proof scoping, typed created-passport discovery, and QR/PDF target consistency. Focused regression tests have been added. The current branch passes 36 tests, TypeScript checking, production build, and formatting; the build retains its existing large-chunk warning. These fixes require partner review before integration. The other findings below remain open.

Preserve the original roadmap as historical analysis. This plan narrows the immediate work: improve the existing application and reusable product experience, while leaving Soroban, Stellar wallets/SDKs, deployment, storage redesign, and historical migration until the hackathon. Record preparation commits separately from event work. Organizer rules, acceptance, dates, and prize requirements in the older audit have not been reverified here.

## Remaining findings

References below are paths/lines at `fa12ad5`, unless marked as Move contract source.

| Priority | Finding and impact | Evidence | Owner |
| --- | --- | --- | --- |
| P1 | Registration has no preparing/simulating busy state; it clears existing result state before reaching the duplicate-submission guard. Wallet/account changes also lack an operation identity guard. | `web/src/components/DeviceRegistration.tsx:189`, `:241` | A |
| P1 | Live decoding silently discards malformed repair entries, substitutes the current time for missing coverage, and substitutes a plausible condition for unknown codes. This can hide incomplete history or invent apparently valid data. | `web/src/data/passport-adapter.ts:197`, `:505`, `:522` | A |
| P1 | Scanner requests have no latest-request guard. A slow earlier lookup can replace a newer lookup or explicit demo selection. Pending camera permission can also finish after Stop or a demo selection. | `web/src/components/QrPassportScanner.tsx:99`, `:141`, `:155` | B |
| P1 | App copies asynchronous query results into independent passport state without a selection-version check. Selecting demo while a live read remains pending needs a regression test to ensure late data cannot replace demo content. Browser history is not synchronized through `popstate`. | `web/src/App.tsx:70`, `:101`, `:118` | B |
| P2 | Repair notes and battery health are prefilled with a specific successful repair and 96%. These defaults can become accidental public claims. | `web/src/components/RepairWorkspace.tsx:58` | A |
| P2 | The public QR view still describes repairer-only details as locked/unlocked, although the live model has no private work-order storage. The reader also ignores the existing ledger attestation timestamp. | `web/src/components/QrPassportScanner.tsx:630`; `web/src/data/passport-adapter.ts:546` | B copy; A data |
| P2 | QR/PDF target mismatch is fixed. Export failures still lack local user-facing recovery. | `web/src/components/PassportQrDownload.tsx` | B |
| P2 | Public visitors encounter registration before the passport. Repeated summaries, wallet prompts, and scanner details make the main buyer journey longer than necessary. | `web/src/App.tsx:267`; scanner result and passport sections | B |
| P2 | Authorization becomes stale without periodic role checks; RPC failures and revocation need explicit retry/refresh UX. On-chain checks still enforce permissions. | `web/src/hooks/use-repairer-authorization.ts`; registrar equivalent | A |

The supplied local registrar/admin IDs are still identical, so the new foundations reader will intentionally block registration. The older audit also reports an incompatible default passport package; the user-supplied passport is a different ID and was not verified in this review. Diagnose configuration using read-only checks. Do not recover wallets, grant roles, republish contracts, or change live chain state as part of this preparation plan.

## Shared preparation: finish once before splitting

Akif owns this short prerequisite, reviewed by Yhlas. Lifecycle mapping is fixed on the current branch; the other prerequisites remain planned.

1. Review and integrate `fa12ad5` into `developer`; record the resulting base commit.
2. Verify the completed lifecycle labels and conversion tests everywhere, including registration options, fixtures, and existing test data, without changing numeric contract codes.
3. Add an optional `attestedAt` field to `RepairRecord`, using the same `{ isoDate, displayDate }` representation as `serviceDate`. Populate it from `attested_at_ms`; retain `serviceDate` as the repairer's claimed service date. Missing legacy attestation time stays absent, never synthesized. Both times must be labeled distinctly in views.
4. Freeze exported domain types, existing component props, and function signatures at this base commit. Keep `DeviceRegistration.onPassportCreated(objectId)`, `RepairWorkspace({passport, onRepairConfirmed})`, and the scanner callbacks compatible. New internal helpers are allowed.
5. Both people branch from this exact commit into `prep/records-and-transactions` and `prep/public-experience`. Each uses a separate checkout/worktree and separate dev-server port. Do not have two AIs operate in one checkout.

This prerequisite removes the known shared-model change from parallel work. Afterwards, the two branches must compile and pass independently against the frozen base, without requiring the other branch to be merged first.

## Akif (Person A): records, registration, and repair reliability

Exclusive existing-file ownership:

- `web/src/data/passport-adapter.ts` and its tests.
- `web/src/data/sui-passport.ts` and its tests.
- Both authorization hooks, plus new colocated hook tests.
- `web/src/components/DeviceRegistration.tsx` and new colocated tests.
- `web/src/components/RepairWorkspace.tsx` and its tests.
- `web/src/components/TransactionStatusPreview.tsx`.
- `web/src/lib/transaction-flow.ts` and its tests.
- Public configuration: `web/src/constants.ts`, `web/src/dApp-kit.ts`, `web/.env.example`, and `web/src/vite-env.d.ts`.
- `README.md`, `CONTRIBUTING.md`, `AI_USAGE.md`, and new `docs/PREPARATION_A.md`.

Work in this order:

1. **Complete operation scoping.** Repair drafts now reset on passport/account change and proof is scoped to the original device/account. Test delayed signing and wallet switching; freeze editable fields while preparing/signing. Do not silently reassign a transaction to the new selection.
2. **Complete registration reliability.** Created passport discovery now validates the object type rather than object order. Add preparing/simulating state, guard before clearing previous proof, and preserve successful digests on lookup failure. Test account switching and delayed results. This is frontend reliability work; no Move changes or deployment.
3. **Validate reads honestly.** Reject unknown lifecycle values, invalid timestamps, and malformed required fields using the existing typed error vocabulary. Do not drop corrupt repair records or invent coverage dates. Preserve absent optional values and the Sui contract's existing battery sentinel semantics; do not invent a new wire format.
4. **Improve authorization and forms.** Recheck on account change, focus, and immediately before sending; provide a retry path for unavailable/configuration states. Use empty repair notes and battery input with examples as placeholders. Require review of the target device and public fields; retain existing serial-hash behavior and show normalization clearly. Distinguish local validation errors from confirmed ledger failures.
5. **Prepare reproducible setup.** Document one root install, Node 22.22.2, demo-only use, live configuration blockers, public origin, and manual wallet checks. Any configuration verification is read-only. Keep global styling and shared primitives unchanged.

Acceptance:

- Tests cover every lifecycle code, invalid live records, absent dates, and distinct service/attestation times.
- Device/account switches never carry a repair draft or stale success into another device's form.
- Multiple created objects cannot produce a wrong passport ID.
- Rapid submit, delayed signing, readback timeout, and cancellation produce correct states without losing known proof.
- No tests sign live transactions; external RPC/wallet boundaries are mocked.
- Existing public exports/props remain compatible, and B's files are untouched.

## Yhlas (Person B): public passport, scanner, QR/PDF, and accessibility

Exclusive existing-file ownership:

- `web/src/App.tsx` and its tests.
- `web/src/components/QrPassportScanner.tsx` and new colocated tests.
- `web/src/components/PassportQrDownload.tsx` and new colocated tests.
- `web/src/lib/passport-url.ts`, `web/src/lib/passport-pdf.ts`, and their tests.
- `web/src/index.css`, `web/index.html`, and `web/src/components/ui/**`.
- `docs/UI_UX_BRIEF.md` and new `docs/PREPARATION_B.md`.
- New public-presentation components under `web/src/components/public/**` and new browser tests under `web/e2e/public/**` if approved by the shared tooling owner.

Work in this order:

1. **Make selection deterministic.** Keep route, active passport, demo mode, and data provenance consistent; prevent pending reads from overwriting a newer selection. Honor browser Back/Forward and direct links. Render a passive initial state until a selection resolves; do not enable a fixture write. Preserve the existing registration/repair callback contracts.
2. **Fix scanner lifecycle.** Track the current lookup and camera request; ignore superseded completions; stop every acquired track after cancellation/unmount; prevent overlapping scans/lookups and show loading/retry states. Test permission denial, unsupported cameras, stop-before-permission-resolution, and out-of-order results.
3. **Put the buyer journey first.** Show a linked passport before the registration/scanner sections when opening its URL. Make issuer/repairer actions secondary navigation. Reduce repeated device summaries, show empty histories clearly, and distinguish fixture, stale, and live content. Label service date as claimed and `attestedAt` as the recorded attestation date. Remove suggestions that a connected wallet makes public chain data private.
4. **Complete QR/PDF output.** Old QR output is now invalidated on target change and export is disabled until the image matches the active payload. Add generation/export errors and retry. Preserve the public-origin warning, expose a copyable passport link with clipboard-failure feedback, and test that PDF text, link, and QR all identify the same device.
5. **Check accessibility and mobile behavior.** Test 375-pixel layouts, 200% zoom, keyboard navigation, useful form names, visible focus, error announcements, reduced motion, long IDs, and long repair histories. Scope CSS to public components so A's forms do not change. Lazy-load optional public/scanner/PDF work only if profiling supports it; do not change wallet/provider initialization.

Acceptance:

- Direct URL, invalid URL, live failure, stale refresh, demo selection, and Back/Forward all display the intended device and provenance.
- A late live read cannot replace an explicitly selected fixture; a late scan cannot replace a newer scan.
- Camera cancellation releases tracks even if permission resolves later.
- Rapid device switching cannot export the previous device's QR with the new device's metadata.
- No private-history claim, horizontal mobile overflow, keyboard trap, or unexplained blank error state in public flows.
- Tests mock A's service boundary; A's files and public contracts are untouched.

## Conflict prevention and integration rules

- A owns the complete transaction form components, including their copy and styling. B owns the complete public experience. B must not restyle A's components through broad global CSS selectors.
- After preparation, both people treat exported domain types, callback signatures, and shared primitive APIs as frozen. No symbol renaming, file moves across ownership boundaries, new mandatory props, or changed exports during the parallel phase.
- B may style shared UI primitives but must preserve their signatures, default semantics, and disabled/focus behavior. New presentation components must not change transaction component imports or props.
- Root manifests, lockfile, test/build configs, CI, `web/src/main.tsx`, and this plan are frozen for parallel work. A is the sole tooling/integration owner if a required dependency or shared config change arises; merge that prerequisite into the base, then update both branches before continuing.
- New A helpers go under `web/src/lib/records/**`; new B helpers under `web/src/lib/public/**`. Tests stay beside owned files. Do not run repo-wide autoformatters, dependency upgrades, or cleanup from either branch.
- Use local env files in each checkout; do not commit them. Do not change the other's environment or dev server. Preserve the existing Sui implementation and do not touch `move/**` in this phase.
- Each AI task prompt must include its ownership list, frozen contracts, acceptance cases, and prohibition on touching the other workstream. Unexpected cross-boundary work becomes a small separate integration task, not an opportunistic edit.
- Merge Akif's branch then Yhlas's branch into `developer`, run the full checks again, and jointly test the real browser/wallet/phone path. Disjoint files reduce merge conflicts; combined testing is still required because both workstreams use the same domain data.

## Joint completion checklist

- Clean `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, post-build `npm run format:check`, and `npm audit --audit-level=high` pass on the combined commit.
- Existing tests stay green; new tests cover the review findings rather than only checking rendered labels.
- Browser smoke checks use mocked RPC for deterministic failures/races, plus a separate manual session for a compatible live Sui deployment if available. A blocked registrar is documented truthfully rather than bypassed.
- No real transaction, role change, contract publication, hosted deployment, or wallet recovery is performed without a separate explicit task.
- Both people review the other's diff, run the other person's setup instructions, and rehearse a wallet-free passport demo plus a clearly labeled offline fixture.
- Keep Stellar contracts, Stellar wallets/SDKs, bridges, tokens/payments, passkeys, evidence uploads/private storage, Move schema redesign, production indexing, and major visual rebranding out of this preparation phase.

Suggested budgeting: 2-4 person-hours for shared preparation; roughly 12-18 person-hours for Akif and 12-18 for Yhlas; 3-5 joint hours for integration and real-device checks. These are planning estimates, not measured delivery times. If time is short, finish P0/P1 correctness and the public demo before performance work or extra visual polish.
