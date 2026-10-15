# Pre-Hackathon reliability fixes

**Preparation date:** 15 October 2026 (Europe/Warsaw)

**Starting commit:** `e3df9c04a7ec373e78db062e0992b80e26815523` (`origin/developer`)

**Feature branch:** `fix/pre-hackathon-foundations`

## Scope and disclosure

This is pre-event engineering preparation, not HackMeridian event work or an
organizer approval claim. It preserves the original Sui implementation and
audit history while removing reusable reliability problems before a separate
Stellar implementation begins. No Move source or lockfile, wallet, deployment,
blockchain state, or real environment file was changed.

## Finding disposition

| Finding  | Status                            | Result                                                                                                                                                                                                                                                                    |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RDEV-003 | Fixed                             | Live reads and demo fixtures now use explicit provenance. Fixtures have an exact non-live label, no explorer/QR proof, and no transaction actions. Failed reads never become successful demo reads.                                                                       |
| RDEV-004 | Partially fixed                   | Removed the fake file picker, filename-derived `demo-evidence://` writes, and uploading stage. New repairs submit the contract-supported empty string. Real evidence storage remains deferred.                                                                            |
| RDEV-005 | Fixed at the current Sui boundary | Passport and capability readers validate the configured package, module, and object type before trusting fields. Incompatible historical deployments fail closed with a configuration diagnostic.                                                                         |
| RDEV-006 | Partially fixed                   | Cancellation, ledger failure, unknown status, confirmed success, and confirmed-success/readback-failure are distinct. Known digests persist, refresh retry is read-only, and duplicate submits are guarded. Durable recovery and contract idempotency remain future work. |
| RDEV-011 | Fixed                             | The root `package-lock.json` is authoritative and synchronized; the redundant `web/package-lock.json` was removed. Clean root `npm ci` succeeds without changing tracked dependency files.                                                                                |
| RDEV-012 | Fixed for the current lock        | jsPDF and the three vulnerable transitives were updated deliberately. The final fresh audit has no findings.                                                                                                                                                              |
| RDEV-013 | Fixed for the frontend            | Added deterministic Vitest coverage and a read-only GitHub Actions workflow for install, format, typecheck, tests, build, and high/critical audit.                                                                                                                        |
| RDEV-014 | Partially fixed                   | Invalid routes are actionable, unsafe QR/evidence protocols are rejected, localhost QR output is warned, and a validated HTTPS public origin is supported. README no longer claims QR-image upload. Real phone-camera testing remains pending.                            |
| RDEV-015 | Fixed at the current boundary     | Authorization reads now distinguish confirmed unauthorized results from invalid configuration and RPC unavailability. Failures disable signing without claiming permission denial.                                                                                        |

## Dependency remediation

The repaired workspace was audited with npm 11.6.2. The affected graph and
exposure assessment were:

| Package and path                                        | Prior version | Resolution                                 | Exposure                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------- | ------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web -> jspdf`                                          | 3.0.4         | 4.2.1                                      | Runtime PDF generation. The app used text, a generated PNG QR, safe links, and `save`; it did not use the advisory-highlighted HTML/new-window, AcroForm, `addJS`, untrusted image, or Node file-reading APIs. Updated because future use could expose those paths. Relevant advisories include [GHSA-wfv2-pwc8-crg5 / CVE-2026-31938](https://github.com/parallax/jsPDF/security/advisories/GHSA-wfv2-pwc8-crg5), [GHSA-7x6v-j9x4-qf24 / CVE-2026-31898](https://github.com/advisories/GHSA-7x6v-j9x4-qf24), and the upstream [4.2.1 security release](https://github.com/parallax/jsPDF/releases/tag/v4.2.1). |
| `web dev -> @mysten/codegen -> cosmiconfig -> js-yaml`  | 4.3.0         | 4.3.2 within the existing supported range  | Development/code-generation only; no public request supplies YAML. Fixed [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) and [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh).                                                                                                                                                                                                                                                                                                                                                                                 |
| `web dev -> Vite/PostCSS -> nanoid`                     | 3.3.16        | 3.3.20 within the existing supported range | Build tooling only; the application does not expose custom generator parameters. Fixed [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8).                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `web dev -> Vite/PostCSS and Tailwind -> source-map-js` | 1.2.1         | 1.2.2 within the existing supported range  | Build tooling only; public users do not submit source maps. Fixed [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

No `overrides` were needed. The final audit reported zero low, moderate, high,
or critical findings; there are no open dependency exceptions in this lockfile.

## Verification evidence

- Root clean install with npm 11.6.2: passed.
- `npm run format:check` before and after a production build: passed.
- `npm run typecheck`: passed.
- `npm test`: 7 files and 22 tests passed.
- `npm run build`: passed; Vite reported only its existing large-chunk warning.
- `npm audit --audit-level=high`: passed with zero findings.
- Local Vite server: reached ready state at `http://127.0.0.1:5173/`.
- Browser checks: initial disconnected state, explicit demo state, malformed
  route, missing object, configured-package mismatch, disconnected registration,
  fixture-disabled repair, and 375-pixel-class narrow layout were inspected.
  No horizontal document overflow or browser console errors were found. Only
  expected development-mode burner-wallet/Lit warnings appeared.
- PDF/QR check: jsPDF 4.2.1 produced a one-page A4 PDF that Poppler opened and
  rendered cleanly. Text and safe link annotations were extracted, and the QR
  image decoded to the exact intended public passport URL.
- No wallet was connected, no camera permission was granted, and no transaction
  was signed. Authorized registration/repair states and real phone-camera
  behavior therefore remain manual checks.

## PR #8 review follow-up — 15 October 2026

Two independently reproduced review findings were fixed without changing the
Sui contract or deployment configuration:

- A confirmed repair digest is now published before passport readback begins.
  The UI keeps the explorer link visible while refreshing, limits each readback
  attempt to 10 seconds, preserves confirmed status on rejection or timeout,
  and offers a read-only retry. Operation tokens and abortable timeout cleanup
  prevent abandoned or late readbacks from updating a newer view.
- Authorization tests now stub explicit package and capability IDs before
  dynamically importing the configuration-dependent modules. They cover equal
  registrar/admin IDs, distinct active ownership, other/inactive ownership,
  RPC failure, and wrong capability type without depending on checked-in or
  developer-local environment values.

The follow-up suite passed with 7 files and 31 tests under both an environment
with no relevant overrides and a synthetic environment containing distinct
valid registrar/admin IDs. Type checking, production build, post-build format
checking, and the high-severity dependency audit also passed. All transaction
tests used mocked wallet/RPC boundaries; no wallet was connected and no
blockchain transaction was submitted.

## Partner setup

```bash
git switch fix/pre-hackathon-foundations
npm ci
cp web/.env.example web/.env.local
# Replace placeholders with one mutually compatible Sui Testnet deployment.
npm run dev
```

Before sharing a printed QR, set `VITE_PUBLIC_APP_ORIGIN` to the deployed HTTPS
origin. Validate changes with:

```bash
npm run format:check
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
```

## Known Sui-only limitations deliberately deferred

- The checked-in demo passport belongs to a different package from the write
  package, and the default registrar capability ID is an `AdminCap`. These are
  diagnosed, not silently replaced or repaired.
- Registration still discovers the first created object rather than selecting
  the created `DevicePassport` by type. A confirmed transaction whose passport
  cannot be discovered retains its digest and offers read-only lookup retry.
- Repair history remains one unbounded vector; input/lifecycle/time semantics,
  role recovery, serial commitment design, and old capability assignments were
  not changed.
- There is no evidence upload, private evidence, transaction persistence across
  reloads, contract request-id idempotency, or deployed public origin in this
  preparation branch.

## Later Stellar work (next three tasks)

1. Implement and test the minimal Soroban trust boundary: administrator role
   management, unique device registration, wallet-free reads, repair
   attestation, bounded inputs, and negative authorization cases.
2. Replace the narrow Sui reader/writer with one Stellar service that binds
   reads to Testnet passphrase and contract ID, simulates before signing, polls
   transaction finality, and paginates separate repair records.
3. Configure a public HTTPS demo and complete real Freighter/mobile QR testing,
   transaction recovery by hash/request ID, and the event-baseline/change
   disclosure before considering passkeys, payments, bridges, or evidence
   storage.
