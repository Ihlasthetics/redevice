# Yhlas — public experience preparation

## Starting point and integration

- Branch: `prep/public-experience`.
- Exact implementation base: `9e41f617aeaad999efca967da472d166e03b97fb`
  (`origin/main`, inspected after fetching on 21 October 2026).
- PR #8 is merged, with final head `6cdc52086e634fa0db7f4c06749fabd159588456`.
  It targeted **main**, not developer. PR #9 also merged Akif's follow-up into main.
  `origin/developer` still points to `e3df9c04a7ec373e78db062e0992b80e26815523`.
  Using developer alone would omit the required foundation fixes and shared type.
- The new task branch was initially created at the old remote foundations tip
  `fa12ad5`, then fast-forwarded to current main before implementation. No
  existing branch history or local work was reset or discarded.
- Worktree: `/private/tmp/redevice-public-experience`. The original main checkout
  and its existing uncommitted files were preserved and were not used as inputs.
- The PR targets developer as requested. Its aggregate diff includes already
  merged foundation/Akif commits until developer receives main. Review B's changes
  against the exact implementation base above. Integrate the existing main history
  into developer before merging B; do not duplicate or cherry-pick those fixes.

## Delivered behavior

- The URL selects the query; query results are never copied into independent
  selected-passport state. Direct links, pushState navigation, and popstate
  Back/Forward share the same model. Explicit demo is represented by `?demo=1`.
- A pending old query cannot replace demo or a different passport. Cached content
  is limited to the same ID and marked stale while refreshing or after failure.
  Invalid links, missing/incompatible objects, and RPC errors offer recovery.
- Passport identity/history appear before scanner and issuer/repairer tools.
  Empty repair histories are explicit. Repeated scanner summaries and misleading
  wallet-based privacy/unlock claims are removed. Fixture writes remain disabled.
- Scanner camera/lookup generations reject late completions. Stop, unmount,
  demo, manual selection, and navigation release media tracks, including streams
  returned after permission cancellation. Camera detection starts only one lookup.
  Permission failures and unsupported cameras retain manual input and retry.
- The scanner's original callbacks remain supported. An optional
  `onLookupRequested` lets App own route selection and its live read; standalone
  callers retain the existing resolved-passport callback behavior. Route changes
  remount the scanner to cancel pending camera/lookup work.
- QR generation has retry; PDF generation/save has retry and a synchronous
  duplicate-export guard. Exports capture one set of metadata/URL/QR/explorer data
  and are abandoned before save if selection changes. A save already handed to
  the browser cannot be revoked, but never reports success for a newer selection.
- Public link input supports manual copying; clipboard success is reported only
  after write fulfillment. Existing origin warnings, protocol validation, filename
  sanitation, and QR-target matching are preserved.
- Public styles wrap long IDs/notes, preserve hidden semantics and focus, and
  disable public animations/transitions under reduced motion. Navigation focuses
  the public result. Transaction forms, shared primitives, manifests, lockfiles,
  CI, configuration, domain exports, and chain files are unchanged.

## Timestamp prerequisite

Akif's shared `RepairRecord.attestedAt` is integrated in the selected base and
comes from `attested_at_ms`. The public timeline uses that exported type directly:
“Claimed service date” and “Ledger attestation date” are separate. Legacy records
with no attestation timestamp omit the latter. No timestamps are synthesized.

## Verification

Final checks used Node **22.22.2**, npm **11.6.2**, and the unchanged root lockfile:

- `npm ci`: passed.
- `npm test`: passed, 10 files / 83 tests. Existing tests retained; new tests cover
  route/query races, history, missing-object retry, stale refresh, dates, late
  camera permission after Stop/unmount/demo, denial/retry, unsupported camera,
  repeated detections, out-of-order lookups, QR/PDF failure/retry, export snapshots,
  duplicate export prevention, and clipboard success/failure.
- `npm run typecheck`: passed.
- `npm run build`: passed; existing large main-chunk warning remains (~917 kB).
- `npm run format:check`: passed. Only changed files were formatted.
- `npm audit --audit-level=high`: passed, zero vulnerabilities.
- `git diff --check`: passed. Scope review compared all changes to the recorded
  base; no Akif-owned changes, secrets, generated output, or dependency edits.

Browser smoke checks used the available in-app browser and a **temporary external
Vite configuration** mocking only public read boundaries. Neither that configuration
nor its synthetic data is shipped. Verified: slow read followed by demo (including
late completion), failed RPC recovery, Back/Forward, keyboard Tab/Enter manual
submission and demo selection, explicit fixture transaction disablement, optional
date rendering, and a 375 × 812 viewport with long IDs and unbroken notes. The
document's scroll width equaled its 375-pixel viewport. No browser console errors
were observed. These synthetic reads are not evidence of live Sui compatibility.

## Manual checklist and remaining limitations

- [ ] Real browser 200% zoom: the available browser API rejected zoom shortcut
      keys, so no successful zoom check is claimed. Verify reflow and reachable controls.
- [ ] Screen reader announcements/focus and a full keyboard-only walkthrough,
      including QR retry, clipboard denial, and download permission behavior.
- [ ] Long multi-record history on physical small screens and desktop browsers.
- [ ] Phone camera on HTTPS: permission deny/retry, Stop before permission, switch
      to demo during permission, background/resume, repeated detections, and track LED off.
- [ ] Download a real PDF on Safari/Chrome/mobile, print it, and scan its QR on
      a second phone using the intended deployed public origin.
- [ ] Separately authorized live-wallet checks against a compatible deployment.
      This task did not connect a wallet, sign transactions, change roles, or verify
      real-chain registration/repair success.

No chain state, contracts, secrets, deployment configuration, or hosted deployment
was changed. No PR was merged and no protected branch was pushed. This is pre-event
Sui application preparation, with Codex assistance, not Stellar implementation or
an event eligibility claim.
