# HackMeridian 2026 readiness audit and Stellar roadmap

**Report date:** 13 October 2026 (Europe/Warsaw)
**Repository:** `Ihlasthetics/redevice`
**Audited Git baseline:** `74fb0fdc097aa044f250379a1b48d1720b168c65` (`origin/main`)
**Documentation branch:** `developer`
**Audit type:** read-only application and event audit plus implementation planning; no application, dependency, contract, or deployment changes

> **Remediation note — 15 October 2026:** the audit evidence below remains a
> historical snapshot of the audited commit. Scoped pre-event reliability fixes
> were implemented later on `fix/pre-hackathon-foundations`; see
> [PRE_HACKATHON_FIXES.md](PRE_HACKATHON_FIXES.md). This note does not rewrite
> the original failures as audit-time passes.

> **Preparation update — 18 October 2026:** this audit remains a historical snapshot of the audited commit. The two-person plan below covers pre-hackathon improvements only, not a Stellar implementation. The separate `fix/pre-hackathon-foundations` branch contains reliability fixes awaiting review and integration.

## Pre-hackathon two-person execution plan

### Shared base before parallel work

1. Review and merge `fix/pre-hackathon-foundations` into `developer`. Its follow-up work corrects lifecycle labels/codes, repair draft and proof scoping, typed created-passport discovery, and QR/PDF target consistency. Verify the PR checks and diff before treating those changes as integrated.
2. Finish the one shared model prerequisite: add an optional ledger attestation timestamp from `attested_at_ms`, distinct from the repairer's claimed `serviced_at_ms`. Never synthesize a missing legacy timestamp; label the two dates separately.
3. Freeze exported passport types, component props/callbacks, and shared UI primitives at the resulting base commit. Keep `DeviceRegistration.onPassportCreated(objectId)`, `RepairWorkspace({ passport, onRepairConfirmed })`, and scanner callbacks compatible. Both people start from that exact commit in separate worktrees and use separate development ports.
4. Keep Sui as the preparation baseline. Do not add Stellar SDKs, Soroban contracts, wallets, bridges, payments, or a generic multichain layer before the competition. Record the final pre-event commit and clarify the judged-work boundary with organizers.

### Akif — records and transaction reliability

**Exclusive existing files:** `web/src/data/passport-adapter.ts`, `web/src/data/sui-passport.ts`, their tests, both authorization hooks, `DeviceRegistration.tsx`, `RepairWorkspace.tsx`, `TransactionStatusPreview.tsx`, `web/src/lib/transaction-flow.ts`, configuration (`constants.ts`, `dApp-kit.ts`, `.env.example`, `vite-env.d.ts`), and setup documentation (`README.md`, `CONTRIBUTING.md`, `AI_USAGE.md`). New record helpers go under `web/src/lib/records/**`; tests stay beside owned files.

1. Complete operation identity for device and wallet changes. Snapshot submitted fields, ignore stale completions, retain a known digest only with its original device/account, and test delayed signing, cancellation, timeout, and retry. Freeze editable fields during signing.
2. Complete registration reliability. Keep type-validated passport discovery, add preparing/simulating feedback, guard before clearing previous proof, and preserve confirmed digests when readback fails. Test multiple created objects and account changes without live signing.
3. Reject malformed live records rather than dropping repair entries or inventing dates. Reject unknown lifecycle codes and invalid required timestamps; preserve optional absence and the existing Sui battery sentinel. Test invalid records and claimed-versus-attested dates.
4. Replace prefilled successful-repair claims with empty inputs and examples. Recheck authorization on account change, focus, and immediately before sending; offer retry for RPC/configuration errors. Explain public notes and serial normalization honestly.
5. Document reproducible Node 22.22.2/root `npm ci` setup and live-configuration blockers. Configuration verification is read-only: do not recover wallets, grant roles, republish, or sign real transactions for this plan.

**Acceptance:** no draft or success leaks across accounts/devices; invalid records fail closed; rapid submits cannot duplicate writes; known proof survives readback failure; mocked tests cover these cases without touching Yhlas's files.

### Yhlas — public passport, scanner, QR/PDF, and accessibility

**Exclusive existing files:** `web/src/App.tsx`, `QrPassportScanner.tsx`, `PassportQrDownload.tsx`, `web/src/lib/passport-url.ts`, `web/src/lib/passport-pdf.ts`, their tests, `web/src/index.css`, `web/index.html`, `web/src/components/ui/**`, and `docs/UI_UX_BRIEF.md`. New public presentation components go under `web/src/components/public/**`; do not alter Akif's transaction forms or shared domain exports.

1. Make route, selected passport, demo mode, and provenance deterministic. A late live query must not replace a newer demo/scan selection. Support direct links and Back/Forward with clear loading, missing, incompatible, and RPC-error states.
2. Guard scanner lookups and camera permission requests by request identity. Ignore superseded results, release acquired tracks after Stop/unmount even when permission resolves late, and test denial, unsupported cameras, out-of-order scans, and retry.
3. Put the buyer's linked passport first. Reduce repeated summaries and wallet prompts; show empty histories clearly; distinguish live, stale, and fixture content. Never describe public chain data as private because a wallet is connected. Label claimed service and ledger attestation dates distinctly after the shared model is ready.
4. Build on the QR target-consistency fix: show generation/export errors and retry, offer a copyable public link with clipboard-failure feedback, preserve the HTTPS-origin warning, and verify that PDF metadata, link, and QR identify the same device.
5. Check a 375-pixel viewport, 200% zoom, keyboard/focus flow, announced errors, long IDs/history, and reduced motion. Scope CSS to public components so Akif's forms do not change indirectly.

**Acceptance:** direct routes, demo selection, Back/Forward, scan races, camera cancellation, and rapid QR target changes pass mocked tests; public claims are honest; mobile and keyboard walkthroughs have no blocking defects.

### Integration and exit gate

- Akif owns transaction/data files; Yhlas owns public presentation. Neither changes the other's existing files during parallel work. Root manifests, lockfile, CI, `web/src/main.tsx`, and shared exported interfaces are frozen; necessary shared changes become a separate, jointly reviewed integration task.
- Each person uses a separate worktree and port. Each AI task prompt includes file ownership, frozen contracts, tests, and the prohibition on cross-workstream edits. Neither branch runs repo-wide autoformatters or dependency upgrades.
- Merge Akif's preparation branch first and Yhlas's second into `developer`; both review the other's diff. Then run clean `npm ci`, tests, typecheck, build, formatting, and high-severity audit on the combined result. Rehearse a wallet-free passport demo and a clearly labeled offline fixture; separately perform manual browser, wallet, and phone checks if compatible live Sui configuration is available.
- Keep the final pre-event commit and preparation changelog separate from competition work. Do not claim organizer eligibility or a successful live transaction from mocked tests. Defer Stellar implementation, evidence uploads/private storage, Move schema redesign, production indexing, and major rebranding until the event or a separately agreed phase.

## Evidence conventions

- **Confirmed** means directly supported by inspected code, an executed diagnostic, a read-only network lookup, or an official source checked on 13 October 2026.
- **High / medium / low confidence** describes confidence in the finding, not its severity.
- **Implemented** means code exists. It does not mean the feature was successfully demonstrated end to end.
- **Recommendation / inference** means a practical conclusion, not an event rule.
- **Not found** means the reviewed official pages did not publish the detail as of the checked date.

No wallet signing, Sui or Stellar transaction, contract deployment, private-key access, recovery attempt, or live end-to-end wallet flow was performed during this audit.

## A. Executive decision

### What ReDevice does today

ReDevice is a Sui Testnet prototype for QR-accessible device passports. Its intended flow is: an authorized registrar creates a passport, a public visitor reads it without a wallet, and an authorized repairer appends an attestation. The repository genuinely contains a substantial React interface, QR camera and paste parsing, PDF/QR generation, Sui transaction construction, a Move authorization model, duplicate-serial protection, repair-history rendering, and seven passing Move unit tests.

That is a useful product and design baseline. It is not, however, a currently reproducible or fully demonstrated application at the audited commit:

- the committed root lockfile cannot install with `npm ci`;
- the default registrar ID is actually an `AdminCap`, not a `RegistrarCap`;
- the default demo passport belongs to a different package from the package used to submit repairs;
- evidence selection stores only a fabricated filename-based reference and never uploads or hashes file bytes;
- fallback data can be presented under a “Live Sui Testnet” label;
- no browser, wallet, mobile-camera, or end-to-end transaction test suite exists.

### Event-track decision

**Recommendation, not an eligibility promise:** apply to **Scale**. The official Build page describes Scale as the path for an existing working product or prototype with a clear Stellar integration opportunity. ReDevice is plainly an existing prototype, and the official FAQ explicitly permits existing projects in Scale. Acceptance remains discretionary under the Terms, and the official pages do not define how much code may be written before the event or how judges distinguish pre-existing work from event work.

Keep a baseline commit and an explicit event changelog. Ask the organizers to confirm the pre-event coding boundary before implementing the Stellar version.

### Technical direction

Pause Sui-specific repair work unless it is needed to preserve a truthful historical demo. Do not spend the remaining preparation window reconciling old Sui accounts, republishing the Sui package, or repairing capability IDs that the Stellar implementation will replace.

The smallest credible Stellar integration is **not** a cosmetic wallet button, payment, or bridge. It is a focused Soroban implementation of the product’s core trust boundary:

1. an administrator manages registrar and repairer roles on-chain;
2. an authorized registrar creates a unique device passport;
3. anyone can read that passport and its paginated repairs without a wallet;
4. an authorized repairer adds an attestation;
5. the UI simulates, signs, submits, polls to final success/failure, and displays Testnet proof;
6. a revoked or unauthorized address is rejected by the contract.

Reuse the product language, UI components, QR/PDF experience, data types, and lessons from the Move contract. Replace the Sui transaction/data layer with one narrow Stellar service and one Soroban contract. Preserve the Sui source and Git history unchanged.

### Main risks

1. **Rules risk:** submission timing, required event-only work, judging weights, exact prize split, maximum team size, repository/video requirements, and AI-disclosure format are not published on the reviewed official pages.
2. **Execution risk:** a two-person team can finish the core port only if it avoids passkeys, uploads, payments, bridging, and a generic multichain abstraction until the minimum demo is stable.
3. **Trust risk:** current labels overstate live provenance in fallback/error states, and serial hashes/evidence references provide less privacy and proof than a user may assume.
4. **Reliability risk:** there is no frontend test harness or CI, and the committed dependency graph is not reproducible.
5. **Operational risk:** Soroban persistent data has TTL and archival behavior; durable records require an explicit extension/restoration owner and UI behavior.

### Next three actions

1. Send the organizer questions in section L, especially the existing-code/preparation boundary, event submission deadline and timezone, judged-work baseline, and Scale prize rules.
2. Freeze `74fb0fdc097aa044f250379a1b48d1720b168c65` as the disclosed pre-event baseline; after the rules answer, create a separate Stellar implementation branch and changelog without rewriting or deleting Sui history.
3. Build one contract-first vertical slice: Soroban role check -> device registration -> wallet-free read -> repair attestation -> final transaction proof. Do not begin passkeys or evidence uploads until that slice and its negative tests pass.

## Do not spend time on this now

- Recovering the old Slush account, importing wallets, or handling recovery phrases.
- Republishing or repairing the old Sui deployment solely to make the checked-in defaults work.
- A Sui-to-Stellar bridge or relabeling Sui history as Stellar-native history.
- A generic multichain framework; one well-isolated Stellar adapter is enough.
- Mainnet deployment, payments, escrow, repair financing, tokens, or cross-chain transfers before the attestation MVP works.
- Custom passkey cryptography, a custom relayer, or a custom wallet contract.
- Production manufacturer onboarding, regulatory-compliance claims, or “official EU DPP” integration.
- Private evidence encryption, complex retention tooling, or permanent decentralized uploads during the core build.
- Pixel-level polish, QR-image upload, or a bespoke explorer before the contract, public read, authorization rejection, and demo recovery path are complete.

## B. Existing feature inventory

| Feature                           | Current status                              | Implementation evidence                                                                                        | Tests/evidence performed in this audit                                                            | Main limitations                                                                                                                             | Decision                                                              |
| --------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Sui Move package                  | Implemented                                 | `move/redevice/sources/redevice.move`; roles, registry, passport, repairs, events                              | `sui move build` passed; `sui move test` passed 7/7 on Sui CLI 1.76.0                             | No string bounds; client-supplied dates; unbounded repair vector; only a subset of invalid inputs tested                                     | **Preserve** source/history; **replace** active contract with Soroban |
| Registrar administration          | Contract methods implemented                | `grant_registrar` and `revoke_registrar`, lines 143–176                                                        | Move tests cover authorized creation and unauthorized registrar; no revocation test for registrar | No admin UI, duplicate-cap registry, account-replacement flow, or recovery design                                                            | **Adapt** role model; **defer** Sui UI                                |
| Repairer administration           | Contract methods implemented                | `grant_repairer` and `revoke_repairer`, lines 178–211                                                          | Authorized, unauthorized, and revoked repairer tests pass                                         | Frontend checks only one configured cap; errors can look like “unauthorized”; admin recovery unspecified                                     | **Adapt** role model                                                  |
| Device registration UI            | Implemented code, default live flow blocked | `web/src/components/DeviceRegistration.tsx:154-289`                                                            | Typecheck/build pass; no wallet transaction executed                                              | Default registrar ID is an `AdminCap`; first “Created” object is assumed to be passport; confirmed transaction can later be labeled rejected | **Replace** Sui transaction layer; reuse form and copy selectively    |
| Duplicate registration            | Implemented in one Sui registry             | `table::contains`/`table::add` at `redevice.move:232-258`; browser SHA-256 at `DeviceRegistration.tsx:129-151` | `duplicate_serial_is_rejected` passes                                                             | Global collision domain ignores manufacturer/model; hash is guessable; no recovery lookup from commitment to passport in UI                  | **Adapt** identity scheme                                             |
| Public wallet-free passport       | Implemented code                            | URL parsing/query in `App.tsx:69-100`; RPC read in `sui-passport.ts:9-21`                                      | Typecheck/build; read-only Testnet object-type checks                                             | Object package/type is not validated; fallback can appear live; RPC/error/mobile behavior not browser-tested                                 | **Reuse** UI; **replace** reader/service                              |
| Repair attestation                | Implemented code and Move logic             | `RepairWorkspace.tsx:106-180`; `add_repair_record` at `redevice.move:268-310`                                  | Move authorized/unauthorized/revoked tests pass                                                   | Default passport is from another package; no explicit finality poll in UI; no idempotency; unbounded history                                 | **Replace** transaction/storage design                                |
| Repair history                    | Implemented                                 | `passport-adapter.ts:400-465`; `App.tsx:440-565`                                                               | Static inspection and build only                                                                  | Whole vector is read; only latest object transaction digest is linked; UI uses claimed service date and ignores ledger attestation time      | **Reuse** presentation; **replace** storage/query model               |
| Evidence                          | Placeholder only                            | Filename -> `demo-evidence://` in `RepairWorkspace.tsx:48-60`; disclosure at `passport-adapter.ts:329-332`     | Static inspection                                                                                 | No bytes, upload, content hash, availability check, or access control; file size is not bounded                                              | **Defer uploads** for MVP; add honest hash/reference plan later       |
| Camera QR scan and pasted payload | Implemented code                            | `QrPassportScanner.tsx`; secure-context and permission errors at lines 140–187                                 | Build only; no real phone/camera test                                                             | README claims QR-image upload, but no QR-image input exists; permissive URL parsing; live fallback issue                                     | **Reuse/adapt** parser and UI                                         |
| QR passport/PDF                   | Implemented                                 | `PassportQrDownload.tsx`                                                                                       | Production build passes                                                                           | URL captures current origin, so `localhost` QR fails on another device; vulnerable/outdated jsPDF; chain-specific wording                    | **Reuse/adapt** after dependency update                               |
| Transaction status UI             | Implemented presentation                    | `TransactionStatusPreview.tsx`; state definitions in `passport-adapter.ts:335-393`                             | Build only                                                                                        | Repair flow never sets `submitting`; success semantics do not map cleanly to final network confirmation                                      | **Reuse** visuals; **replace** state machine                          |
| Demo/fallback data                | Implemented                                 | `fallbackPassport` in `passport-adapter.ts:268-314`                                                            | Static inspection                                                                                 | Can be mistaken for verified live data after sample-button flow or RPC error                                                                 | **Keep only as clearly labeled offline fixture**                      |
| Frontend tests/CI                 | Not implemented                             | No frontend test files, test script, or `.github` workflow found                                               | Search across tracked files                                                                       | Regressions in parsing, state, QR links, authorization, and errors are unguarded                                                             | **Add for Stellar MVP**                                               |
| Documentation/attribution         | Implemented                                 | `README.md`, `AI_USAGE.md`, `CONTRIBUTING.md`, `specs/`                                                        | Inspected history and documents                                                                   | README overstates QR-image upload and current live operability; event baseline/change record not yet defined                                 | **Reuse and update during implementation**                            |

The inventory distinguishes code presence from demonstrated behavior. The audit did not reproduce a successful wallet registration or repair, a rejected wallet flow in a browser, an evidence retrieval, a camera scan, or a second-device QR journey.

## C. Prioritized findings

### Summary

| ID       | Severity | Confidence | Finding                                                                      | Disposition                           |
| -------- | -------- | ---------- | ---------------------------------------------------------------------------- | ------------------------------------- |
| RDEV-001 | Critical | High       | Committed Sui deployment IDs are mutually incompatible                       | Sui-only: preserve/document but defer |
| RDEV-002 | High     | Medium     | Registration assumes the first created object is the passport                | Address during Stellar migration      |
| RDEV-003 | High     | High       | Fallback/demo data can be labeled as live Testnet data                       | Fix regardless of blockchain          |
| RDEV-004 | High     | High       | Evidence file bytes are never uploaded or hashed                             | Address during Stellar migration      |
| RDEV-005 | High     | High       | Read path does not validate package/contract identity                        | Fix regardless of blockchain          |
| RDEV-006 | High     | High       | Submission, confirmation, readback, and retry states are conflated           | Address during Stellar migration      |
| RDEV-007 | Medium   | High       | Repair history grows in one unbounded object/vector                          | Address during Stellar migration      |
| RDEV-008 | High     | High       | On-chain input bounds, lifecycle rules, and time semantics are incomplete    | Address during Stellar migration      |
| RDEV-009 | Medium   | High       | Serial commitment has collision-domain and privacy weaknesses                | Address during Stellar migration      |
| RDEV-010 | Medium   | High       | Public notes/evidence have privacy and retention hazards                     | Fix regardless of blockchain          |
| RDEV-011 | High     | High       | A clean root install is not reproducible                                     | Fix regardless of blockchain          |
| RDEV-012 | High     | High       | Installed dependency tree has one critical and three high advisories         | Fix regardless of blockchain          |
| RDEV-013 | Medium   | High       | No frontend tests or CI protect the demo path                                | Fix regardless of blockchain          |
| RDEV-014 | Medium   | High       | QR, mobile, and public-error behavior is incomplete or overstated            | Address during Stellar migration      |
| RDEV-015 | Medium   | High       | Configuration/RPC failures are presented as authorization failures           | Address during Stellar migration      |
| RDEV-016 | Medium   | High       | Role replacement and administrator recovery are operationally underspecified | Address during Stellar migration      |

### RDEV-001 — Committed Sui deployment IDs are mutually incompatible

- **Severity / confidence:** Critical / high.
- **References:** `web/src/constants.ts:3-25`, `web/.env.example:1-6`, `move/redevice/Move.toml:1-7`, `README.md:60-68`.
- **Evidence:** the registrar and admin defaults are the identical ID. A read-only Sui Testnet lookup confirmed that ID is `0xd960...::redevice::AdminCap`, not `RegistrarCap`. The configured passport `0xc1e9...46666` is a `0xc7db...::redevice::DevicePassport`, while the configured transaction package is `0xd960...`. The repair cap and registry do belong to `0xd960...`. Therefore default registrar authorization cannot pass, and a repair call through `0xd960...::add_repair_record` cannot accept a passport type created by `0xc7db...`. The example calls values “V4” while `Move.toml` declares package version `0.0.3`; the repository does not explain the naming.
- **Local-only context:** untracked deployment receipts in the original working copy show a newer public package `0x24df33...250be`, registry `0x43314e...98c0`, admin cap `0x576ab8...1010`, registrar cap `0xab0ec2...8aea`, and repairer cap `0xaf04e0...5ceb`. Read-only lookups confirmed their types, but no corresponding passport/default config is committed. These files were not staged or changed.
- **User impact:** advertised registration and repair flows fail under checked-in defaults; public reads may still appear to work, which masks the incompatibility.
- **Likely cause:** deployment generations were combined manually and the registrar constant copied from the admin constant.
- **Remedy:** do not republish Sui for HackMeridian. Record the old deployments as historical. For Stellar, generate one checked deployment manifest, validate network/contract identity at startup, require explicit configuration in production, and fail with “configuration invalid,” never “unauthorized.”
- **Stellar relevance / classification:** the specific IDs are Sui-only and should be deferred; the configuration-validation lesson is mandatory for Stellar.
- **Acceptance criteria:** one manifest contains network passphrase, RPC, contract ID, explorer base, and schema version; a startup check verifies the deployed contract; no fallback points to a different deployment; invalid config blocks signing with a precise message.
- **Effort / dependencies:** 2–4 person-hours for the Stellar manifest and validation after Testnet deployment; no Sui repair required.

### RDEV-002 — Registration assumes the first created object is the passport

- **Severity / confidence:** High / medium. The unsafe selection is confirmed; the wrong-object result was not reproduced in a live transaction.
- **References:** `DeviceRegistration.tsx:259-273`; `redevice.move:238-265` creates a passport and adds a table entry/dynamic field in the same transaction.
- **Evidence:** the frontend uses `changedObjects.find(object => object.idOperation === "Created")` with no type or event filter. Multiple objects may be created, and ordering is not a stable passport-identification contract.
- **User impact:** a confirmed registration may generate a QR for a registry dynamic-field object, then fail to load a passport.
- **Likely cause:** the transaction result was treated as an ordered list with one created object.
- **Remedy:** in any retained Sui path, parse the `PassportCreated` event or verify the created object type. In Soroban, return the device ID from `register_device` and emit a typed event; decode the return value from the final successful transaction.
- **Stellar relevance / classification:** address during migration; do not spend event time repairing the Sui flow.
- **Acceptance criteria:** tests cover a transaction with multiple created/changed entries and assert the exact returned/emitted device ID; QR generation occurs only after that ID is decoded.
- **Effort / dependencies:** 2–4 hours after the Stellar client and contract result type exist.

### RDEV-003 — Fallback/demo data can be labeled as live Testnet data

- **Severity / confidence:** High / high.
- **References:** `passport-adapter.ts:268-314`, `App.tsx:69-100`, `App.tsx:231-238`, `QrPassportScanner.tsx:113-127`, `App.tsx:573-575`.
- **Evidence:** `App` starts with `fallbackPassport`. The sample QR ID equals that fallback ID, and `resolvePayload` reuses the in-memory passport without an RPC read when IDs match. `hasResolvedPassport` becomes true immediately. On an RPC error, the page can retain the fallback while the badge condition resolves to “Live Sui Testnet” because it checks only `isPending`.
- **User impact:** users and judges can mistake fixture content and a hard-coded transaction link for a current verified read.
- **Likely cause:** offline convenience data and live query state share one model without provenance.
- **Remedy:** make provenance a required discriminated field (`live`, `recorded-demo`, `offline-fixture`, `error`); never reuse a fixture as a successful lookup; hide live claims and explorer proof unless the network response, contract ID, and record decode all succeed.
- **Stellar relevance / classification:** fix regardless of blockchain, as part of the Stellar reader.
- **Acceptance criteria:** RPC-offline tests show a prominent “offline fixture—not live” label; no “verified/live” badge or explorer proof appears; an explicit retry is available.
- **Effort / dependencies:** 3–6 hours; frontend state refactor and tests.

### RDEV-004 — Evidence file bytes are never uploaded or hashed

- **Severity / confidence:** High / high.
- **References:** `RepairWorkspace.tsx:48-60`, `RepairWorkspace.tsx:140-159`, `RepairWorkspace.tsx:444-490`, `passport-adapter.ts:329-332`.
- **Evidence:** the file input retains only `file.name`; `evidenceReference` converts that name to `demo-evidence://...`; the “uploading” state waits one animation frame. No bytes, content digest, provider request, or availability check exists. The UI disclosure is honest in one location, but “Choose file” and the state name can still imply more than occurred.
- **User impact:** a filename can be mistaken for durable evidence and cannot prove integrity or availability.
- **Likely cause:** the intended Walrus integration was deliberately deferred, but the interaction shell remained.
- **Remedy:** keep uploads out of the mandatory MVP. Either store no evidence or record an explicit optional external URL plus SHA-256 digest and label availability as external/unverified. Add real provider-backed uploads only after core completion as described in section H.
- **Stellar relevance / classification:** address during migration; never port the fake URI behavior.
- **Acceptance criteria:** selecting a file either performs a real byte upload and hashes the exact bytes, or the UI clearly says “local file selected; not uploaded” and prevents an on-chain availability claim.
- **Effort / dependencies:** 2–4 hours for an honest no-upload/hash-only state; 8–16 hours for a safe upload service.

### RDEV-005 — Read path does not validate package/contract identity

- **Severity / confidence:** High / high.
- **References:** `sui-passport.ts:9-21`, `passport-adapter.ts:130-135`, `passport-adapter.ts:400-431`.
- **Evidence:** the Sui response type is available as `object.type`, but `fromSuiObject` validates only field shape. It then states that data came from the published ReDevice package. The read-only lookup proved that the default passport actually belongs to a different package from the configured package.
- **User impact:** a structurally similar object can be displayed with an incorrect provenance/verification label.
- **Likely cause:** schema parsing and trust validation were combined incompletely.
- **Remedy:** the Stellar service must bind every read to the configured network passphrase and contract ID, decode a versioned contract type, and carry the source contract/network through to the UI. Reject unknown schema versions rather than inferring trust from fields.
- **Stellar relevance / classification:** fix regardless of blockchain.
- **Acceptance criteria:** wrong-contract and wrong-network fixtures fail closed; labels include network and shortened contract ID; tests verify provenance before rendering “on-chain.”
- **Effort / dependencies:** 3–5 hours once the Stellar contract ABI is stable.

### RDEV-006 — Submission, confirmation, readback, and retry states are conflated

- **Severity / confidence:** High / high.
- **References:** `DeviceRegistration.tsx:244-288`, `RepairWorkspace.tsx:140-179`, `passport-adapter.ts:347-390`.
- **Evidence:** registration catches failures after a transaction digest exists—including a wait timeout or missing passport ID—and sets the entire operation to `rejected`; the digest is no longer rendered. Repair sets `confirmed` immediately after `signAndExecuteTransaction` returns and never uses the defined `submitting` state or an explicit finality/readback phase. Neither flow has a persisted request ID or reload recovery.
- **User impact:** a transaction may succeed while the UI reports failure, a pending transaction may look final, and retries may confuse users even when the contract prevents duplicate registration.
- **Likely cause:** one status variable represents wallet approval, network acceptance, ledger finality, and data refresh.
- **Remedy:** use a durable state machine: `draft -> simulating -> awaiting-signature -> submitted(hash) -> pending -> success -> readback`, with distinct `failed`, `unknown`, and `readback-failed` outcomes. Persist the hash/request ID locally and make the contract idempotent.
- **Stellar relevance / classification:** mandatory during Stellar migration. Stellar RPC `sendTransaction` normally returns `PENDING`; `getTransaction` must be polled to `SUCCESS` or `FAILED`.
- **Acceptance criteria:** reload resumes polling by hash; timeout shows “status unknown” plus explorer link; retry with the same request ID cannot duplicate a write; readback failure does not relabel ledger success as failure.
- **Effort / dependencies:** 6–10 hours; contract request IDs and client transaction service.

### RDEV-007 — Repair history grows in one unbounded object/vector

- **Severity / confidence:** Medium / high.
- **References:** `redevice.move:82-95`, `redevice.move:288-303`, `passport-adapter.ts:404-465`.
- **Evidence:** every repair is appended to `DevicePassport.repairs`, and every read maps the complete vector. There is no page limit or record-size bound.
- **User impact:** transaction cost, contention, object size, and UI load time grow with history; eventually an update can exceed platform limits.
- **Likely cause:** hackathon-simple aggregate storage.
- **Remedy:** on Stellar, store `Device` separately from `Repair(device_id, index)` plus `repair_count`, and expose bounded pagination (for example, maximum 20 per request).
- **Stellar relevance / classification:** address during Stellar migration; leave Sui history intact.
- **Acceptance criteria:** adding a repair touches only the device summary, count, and one new repair entry; page-size limits are contract-enforced; tests cover multiple pages.
- **Effort / dependencies:** 4–7 hours in contract design/tests; frontend pagination 3–5 hours.

### RDEV-008 — On-chain input bounds, lifecycle rules, and time semantics are incomplete

- **Severity / confidence:** High / high.
- **References:** `redevice.move:213-310`, client limits at `DeviceRegistration.tsx:190-205` and `RepairWorkspace.tsx:119-138,428-440`; `passport-adapter.ts:421-423,437-451`.
- **Evidence:** Move validates lifecycle code and battery `<=100`, but it does not bound strings, reject empty values, constrain lifecycle transitions, or validate client-supplied registration/service times. It records a ledger clock `attested_at_ms`, but the frontend displays only `serviced_at_ms`. Battery value `0` doubles as “not supplied,” so a real 0% measurement cannot be represented distinctly.
- **User impact:** direct callers can create oversized, empty, implausibly dated, or semantically invalid public records; users cannot distinguish claimed service date from authoritative attestation time.
- **Likely cause:** validation lives mostly in the browser and the record model was optimized for demo speed.
- **Remedy:** enforce byte/character bounds and allowed transitions in Soroban; use `Option<u32>` for battery; store `claimed_service_time` separately from `attested_ledger_time = env.ledger().timestamp()`; label both.
- **Stellar relevance / classification:** mandatory during Stellar migration.
- **Acceptance criteria:** contract tests reject empty/oversized values, invalid status transitions, invalid battery values, and unacceptable future dates; public UI labels “service date (repairer claimed)” and “attested on ledger.”
- **Effort / dependencies:** 5–8 hours, primarily contract tests.

### RDEV-009 — Serial commitment has collision-domain and privacy weaknesses

- **Severity / confidence:** Medium / high.
- **References:** `DeviceRegistration.tsx:129-151,190-224`; `redevice.move:46-50,213-258`.
- **Evidence:** normalization uppercases and removes every non-alphanumeric character, then hashes only the normalized serial. The registry is global. The same serial used by different manufacturers/models collides, while distinct formats can normalize to the same string. A public unsalted SHA-256 of a low-entropy or known-format serial is pseudonymous, not anonymous, and can be guessed offline.
- **User impact:** legitimate devices can collide, and an observer may recover or correlate serials.
- **Likely cause:** serial-only deduplication was treated as both identity and privacy.
- **Remedy:** define and publish a versioned, domain-separated commitment over normalized manufacturer namespace + product/model namespace + serial. Continue masking the serial and explicitly call the commitment pseudonymous. Do not introduce a server secret/pepper unless the team accepts its availability and recovery burden.
- **Stellar relevance / classification:** address during Stellar migration.
- **Acceptance criteria:** test vectors document normalization; same serial across manufacturers does not collide; equivalent formatting within one namespace does; UI/privacy copy says hashing does not guarantee anonymity.
- **Effort / dependencies:** 3–5 hours; product decision on manufacturer namespace.

### RDEV-010 — Public notes/evidence have privacy and retention hazards

- **Severity / confidence:** Medium / high.
- **References:** warnings at `RepairWorkspace.tsx:471-480` and `passport-adapter.ts:329-330`; public strings at `redevice.move:69-95`.
- **Evidence:** the UI warns against sensitive content, but the contract accepts arbitrary caller strings and offers no correction, redaction, expiry, or length bounds. Immutable/public evidence can outlive its hosting context.
- **User impact:** names, invoice data, addresses, diagnostic photos, or other personal data can be exposed permanently; revoking a role does not remove past records.
- **Likely cause:** public attestation and evidence retention were not separated.
- **Remedy:** keep public text short and structured; prohibit personal data in UI and demo policy; cap sizes on-chain; store only a digest and availability reference; document that public records cannot be erased. Defer private evidence until there is a real access-control and retention design.
- **Stellar relevance / classification:** fix regardless of blockchain.
- **Acceptance criteria:** on-chain size limits, UI confirmation, safe demo fixtures, unavailable-evidence state, and privacy section in README; no customer documents in demo.
- **Effort / dependencies:** 3–6 hours for MVP controls; private evidence is post-hackathon.

### RDEV-011 — A clean root install is not reproducible

- **Severity / confidence:** High / high.
- **References:** root `package.json`, root `package-lock.json`, nested `web/package-lock.json`, README setup at lines 100–107.
- **Evidence:** `npm ci --ignore-scripts --no-audit` on the clean audited worktree exited 1 with `EUSAGE`, listing direct `jspdf`, `qrcode`, `@types/qrcode`, and their transitives as missing from the root lock. The nested web lock contains them, but npm workspaces use the root lock for the documented root install. The original checkout contains an uncommitted root lock update; it was deliberately not staged.
- **User impact:** a teammate or judge cannot reproduce the app from the committed baseline using deterministic installation.
- **Likely cause:** dependencies were installed/locked in `web/` without synchronizing the workspace root lock.
- **Remedy:** in a later implementation commit, choose one workspace lockfile (root), regenerate it with the pinned npm version, remove the redundant nested lock if appropriate, and prove `npm ci` from a clean clone. Do not use `npm audit fix` automatically.
- **Stellar relevance / classification:** fix regardless of blockchain before event integration.
- **Acceptance criteria:** clean-clone `npm ci`, typecheck, build, tests, and audit all operate from the committed root lock; no lockfile diff remains.
- **Effort / dependencies:** 1–3 hours plus dependency-update testing.

### RDEV-012 — Installed dependency tree has one critical and three high advisories

- **Severity / confidence:** High / high. npm’s maximum advisory rating is critical; practical exposure is narrower than the raw rating.
- **References:** `web/package.json`; PDF path `PassportQrDownload.tsx:74-138`.
- **Evidence:** non-mutating `npm audit --json` against the installed tree reported 4 vulnerable packages: `jspdf@3.0.4` (direct, critical aggregate; affected through `<=4.2.0`, fix indicated at 4.2.1), `js-yaml@4.3.0` via codegen/cosmiconfig (high), `nanoid@3.3.16` via Vite/PostCSS (high), and `source-map-js@1.2.1` via Vite/Tailwind (high). The committed stale lock audit reported only the three high transitives because it omits jsPDF entirely.
- **Exposure assessment:** ReDevice uses jsPDF to write text, an internally generated PNG QR, a link, and save a PDF. It does not call the advisory-highlighted AcroForm, `addJS`, HTML/new-window, untrusted BMP/GIF, or server-side file-loading paths. The other three packages are build/codegen dependencies; no path was found where an untrusted public user supplies YAML, source maps, or Nano ID generator parameters. This reduces current exploitability but does not justify keeping affected versions.
- **User impact:** dependency policy/audit fails; future code could activate vulnerable paths; judges cannot be shown a clean dependency baseline.
- **Likely cause:** fast-moving 2026 advisories plus the stale lock.
- **Remedy:** deliberately update jsPDF to a fixed compatible release and update transitive toolchain packages, then exercise PDF output and build. Review each major-version change; do not run `npm audit fix --force`.
- **Stellar relevance / classification:** fix regardless of blockchain.
- **Acceptance criteria:** audited direct/runtime paths have no known high/critical finding, or any accepted exception is documented with unreachable-code evidence and an owner/date.
- **Effort / dependencies:** 2–6 hours, coordinated with RDEV-011.

### RDEV-013 — No frontend tests or CI protect the demo path

- **Severity / confidence:** Medium / high.
- **References:** no test script in either package file; no frontend test files or `.github` workflows found; Move tests are inline in `redevice.move:389-617`.
- **Evidence:** only typecheck/build/format scripts exist. Move has seven passing tests. QR parsing, provenance, fallback behavior, transaction state, error mapping, public routes, and component accessibility have no automated regression tests.
- **User impact:** the highest-risk demo behaviors can regress during a fast two-person port without warning.
- **Likely cause:** prior hackathon time constraints.
- **Remedy:** add focused unit/component tests and one mocked integration path before broad coverage; add CI for install, format, typecheck, frontend tests, build, contract tests, and secret scanning.
- **Stellar relevance / classification:** fix regardless of blockchain, with tests written alongside the port.
- **Acceptance criteria:** the scenarios in section I run from a clean checkout in CI; failures block merge.
- **Effort / dependencies:** 8–16 hours for the MVP subset; broader browser automation can follow.

### RDEV-014 — QR, mobile, and public-error behavior is incomplete or overstated

- **Severity / confidence:** Medium / high.
- **References:** README lines 49–55; `QrPassportScanner.tsx`; `PassportQrDownload.tsx:16-21`; `App.tsx:73-93,161-168`.
- **Evidence:** the scanner supports camera and pasted content, but there is no QR-image upload despite the README claim. Invalid `?passport=` values are silently ignored. Load errors are generic. Generated QR URLs preserve the current origin, so a QR made at `localhost` points another device to itself. The camera correctly requires HTTPS or localhost, but real mobile permissions/layout were not tested.
- **User impact:** partner/phone demos fail unexpectedly; wrong network, malformed ID, missing record, RPC outage, and unsupported object can look alike.
- **Likely cause:** happy-path UI was completed before deployment and device testing.
- **Remedy:** use chain-aware canonical routes; validate network/contract/device separately; show typed errors and retry; document LAN/HTTPS behavior; remove or implement the QR-image-upload claim.
- **Stellar relevance / classification:** address during migration.
- **Acceptance criteria:** tests cover malformed URL, wrong network, missing/archived record, RPC failure, phone-opened QR, and camera denial; localhost QR warning is explicit.
- **Effort / dependencies:** 5–9 hours plus real-device test access.

### RDEV-015 — Configuration/RPC failures are presented as authorization failures

- **Severity / confidence:** Medium / high.
- **References:** `use-registrar-authorization.ts`, `use-repairer-authorization.ts`, `DeviceRegistration.tsx:362-409`, `RepairWorkspace.tsx:70-74,221-268`, `QrPassportScanner.tsx:71-75`.
- **Evidence:** registrar query errors lead to `isIssuer === false` and the UI says the wallet does not match an active cap. Repairer query errors are explicitly converted to `false`, also producing “wallet lacks permission.” This occurs for stale IDs, wrong object types, network outages, and decode failures.
- **User impact:** users switch wallets or seek new permissions when the real problem is configuration or RPC health.
- **Likely cause:** authorization was modeled as boolean rather than a typed result.
- **Remedy:** return `authorized | unauthorized | wrong-network | invalid-config | unavailable | loading`; only the contract’s role result may produce unauthorized.
- **Stellar relevance / classification:** address during migration.
- **Acceptance criteria:** mocked RPC/config failures produce distinct messages and disable signing; unauthorized is shown only after a successful contract read/simulation.
- **Effort / dependencies:** 3–5 hours in the new service/error model.

### RDEV-016 — Role replacement and administrator recovery are operationally underspecified

- **Severity / confidence:** Medium / high.
- **References:** `redevice.move:129-211`; README authorization table lines 33–43.
- **Evidence:** the publisher-owned `AdminCap` may grant/revoke shared caps, but there is no UI/runbook for replacing an account, discovering all caps, avoiding duplicate grants, or recovering from lost administrator control. The recent local deployment appears to have been created because account/deployment state changed, but no authoritative deployment manifest is committed.
- **User impact:** loss or compromise of the admin credential can strand or centralize the system; a replaced repairer may remain active if old authorization is not revoked.
- **Likely cause:** prototype administration was performed manually.
- **Remedy:** Soroban should have explicit admin and role maps, events, atomic `replace_role`, and a written recovery assumption. For the MVP, use a well-controlled conventional Stellar account and document that loss of its signing authority is unrecoverable unless a preconfigured secondary/multisig policy exists.
- **Stellar relevance / classification:** address during migration; sophisticated governance is post-hackathon.
- **Acceptance criteria:** role grant, revoke, and replace tests pass; old account fails immediately; runbook identifies administrator custody, backup signer policy, and event evidence.
- **Effort / dependencies:** 4–7 hours for contract/test/runbook; multisig UX is later.

## D. Event and prize-readiness matrix

All sources in this section were checked on 13 October 2026. “Official” means HackMeridian, Meridian/Stellar, or Stellar developer documentation—not an aggregator or social post.

### Event acceptance and category fit

| Topic                | Official status/source                                                                                                                                                              | ReDevice gap                                                                           | Proposed work / judge-visible evidence                                          | Priority | Organizer question                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------- | --------------------------------------------------------- |
| Dates and venue      | **Confirmed:** 25–26 October 2026 at ONE16, Lisbon ([home](https://www.hackmeridian.com/), [Build](https://www.hackmeridian.com/build), [FAQ](https://www.hackmeridian.com/faq))    | Travel/attendance outside code audit                                                   | Have both members’ attendance and equipment plan                                | P0       | Confirm daily start/end and submission presentation times |
| Distinguish Meridian | **Confirmed:** Meridian conference is 28–29 October at Convento do Beato; HackMeridian is the two prior days ([Meridian event details](https://meridian.stellar.org/event-details)) | README/project plan must not use conference deadlines                                  | Use HackMeridian dates only in build plan                                       | P0       | None unless conference access matters                     |
| General eligibility  | **Confirmed:** at least 18/age of majority, legal capacity, applicable law; admission discretionary ([Terms §3](https://www.hackmeridian.com/terms.html))                           | Team eligibility not verified by this code audit                                       | Each person verifies registration/acceptance                                    | P0       | Any geography/entity exclusions beyond Terms?             |
| Existing project     | **Confirmed:** existing projects are allowed; Scale is designed for teams pushing one further ([FAQ](https://www.hackmeridian.com/faq))                                             | Must disclose prior Sui work clearly                                                   | Baseline SHA, history, AI disclosure, “built before / built at event” changelog | P0       | How should pre-existing code be marked in submission?     |
| Scale fit            | **Confirmed description, recommendation only:** Scale expects a working product/prototype and clear Stellar integration opportunity ([Build](https://www.hackmeridian.com/build))   | Existing prototype is real, but current defaults are broken and no Stellar code exists | Demonstrate a working Soroban core port and state exactly what changed          | P0       | Does ReDevice’s present maturity belong in Scale?         |
| Genesis fit          | **Confirmed description:** new idea/early prototype, limited Stellar experience ([Build](https://www.hackmeridian.com/build))                                                       | ReDevice is not a new idea; choosing Genesis could under-disclose history              | Prefer Scale                                                                    | P1       | Ask only if organizers redirect category                  |
| Team size            | **Confirmed:** solo participation is allowed and team formation is offered ([FAQ](https://www.hackmeridian.com/faq)). **Not found:** maximum team size                              | Two-person team appears compatible, but no official max was found                      | Register both teammates accurately                                              | P0       | Is a two-person team permitted, and is there a maximum?   |

### Stellar relevance and technical priorities

| Topic                 | Official status/source                                                                                                                                                                                                                         | ReDevice gap                                              | Proposed work / evidence                                                              | Priority | Organizer question                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| Build on Stellar      | **Confirmed:** event asks participants to build working products on Stellar; Scale calls for integrating Stellar ([home](https://www.hackmeridian.com/), [Build](https://www.hackmeridian.com/build), [FAQ](https://www.hackmeridian.com/faq)) | Current implementation is Sui-only                        | Soroban contract, Testnet deployment, Stellar wallet signing, explorer links, tests   | P0       | What is the minimum meaningful Stellar integration for judging/eligibility? |
| Smart contracts       | **Published technical priority, not a separate prize or stated mandate:** one of three “top priorities” ([FAQ](https://www.hackmeridian.com/faq))                                                                                              | None today                                                | Use Soroban for the core trust boundary                                               | P0       | Are priorities scored or simply guidance?                                   |
| Smart accounts        | **Published technical priority, not a separate prize:** FAQ                                                                                                                                                                                    | No Stellar smart account                                  | Optional passkey spike only after MVP                                                 | P2       | Any supported workshop/reference implementation expected?                   |
| Cross-chain transfers | **Published technical priority, not a separate prize:** FAQ                                                                                                                                                                                    | Product has no transfer use case                          | Do not add a bridge just for alignment                                                | Defer    | Is there a sponsor/category where transfers are actually required?          |
| Documentation         | **Confirmed expectation:** clear README showing how the project works, including specs ([FAQ](https://www.hackmeridian.com/faq))                                                                                                               | Current docs are Sui-specific and overstate some behavior | Stellar architecture/setup, contract IDs, limitations, test evidence, event changelog | P0       | Is a separate specification format required?                                |

### Submission completeness and judging

| Topic                        | Official status/source                                                                                                                                                          | Current gap                                               | Proposed work                                                                                     | Status/priority | Unresolved question                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------- |
| Application                  | **Confirmed:** application is through Bizzabo; reviewed on a rolling basis ([Build](https://www.hackmeridian.com/build), [Terms §4](https://www.hackmeridian.com/terms.html))   | Application status not part of repo                       | Apply/confirm both members outside this audit                                                     | P0              | Application close date/time?                                    |
| Submission deadline/timezone | **Not found**                                                                                                                                                                   | Cannot schedule final freeze safely                       | Reserve a conservative final-hour freeze                                                          | P0 unknown      | Exact deadline and timezone?                                    |
| Submission platform          | **Not found**; Bizzabo is confirmed only for registration                                                                                                                       | No submission account/runbook                             | Prepare portable links/text/assets                                                                | P0 unknown      | Platform and required account owner?                            |
| Repository/public access     | **Not found**                                                                                                                                                                   | Repo exists on GitHub; public/private requirement unknown | Keep clean public branch/commit if permitted                                                      | P1 unknown      | Must repository be public, forkable, or created during event?   |
| Demo/pitch                   | **Partially confirmed:** judges/mentors spend time with teams; exact demo format not found ([FAQ](https://www.hackmeridian.com/faq))                                            | No timed script or tested fallback                        | Use section K script; prepare 2-, 4-, and 6-minute variants                                       | P0              | Pitch length, live-demo requirement, slides, and judging slots? |
| Video                        | **Not found**                                                                                                                                                                   | No recording plan                                         | Prepare ability to record, but do not assume required                                             | P1 unknown      | Required? maximum duration/hosting?                             |
| Judging criteria/weights     | **Not found:** FAQ says criteria are on Build page, but reviewed Build page publishes no criteria or weights; Terms defer to event-specific rules/communications                | Cannot optimize to a scorecard                            | Optimize for working product, user value, truthful proof, and technical clarity                   | P0 unknown      | Please provide criteria and weights                             |
| AI assistance                | **Confirmed allowed:** copilots/agents welcome ([home](https://www.hackmeridian.com/), [FAQ](https://www.hackmeridian.com/faq)). **Not found:** disclosure format               | Existing `AI_USAGE.md` is good but event format unknown   | Continue dated disclosure and human verification                                                  | P1              | Is a specific disclosure required?                              |
| Pre-event work               | **Confirmed:** official timeline says “Before: Learn + prepare”; existing projects are allowed. **Not found:** exact coding boundary or what must be built during 25–26 October | Cannot safely assign implementation to pre-event vs event | Do learning, environment checks, architecture, and baseline record; gate code on organizer answer | P0 unknown      | What code/tests/design may be completed before kickoff?         |

### Prize eligibility

| Topic                         | Official status/source                                                                                                                                                                                                                           | Current conclusion                                  | Required action                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ----------------------------------------------------- |
| Total pool                    | **Confirmed:** up to USD 30,000 in XLM across Genesis and Scale ([home](https://www.hackmeridian.com/), [FAQ](https://www.hackmeridian.com/faq))                                                                                                 | A maximum aggregate pool, not a promise to any team | State only “up to $30,000 across tracks”              |
| Track/category amounts        | **Not found:** FAQ says final breakdown will be announced before the event                                                                                                                                                                       | No amount can be attributed to Scale                | Recheck official rules immediately before kickoff     |
| Sponsor bounties/requirements | **Not found**                                                                                                                                                                                                                                    | Do not invent integrations or bounties              | Ask organizers and use only published rules           |
| Judging/prize decisions       | **Confirmed:** panel from ecosystem/partners; decisions final; taxes/fees participant responsibility; prizes non-transferable unless stated ([FAQ](https://www.hackmeridian.com/faq), [Terms §7](https://www.hackmeridian.com/terms.html))       | No eligibility or winning claim can be made         | Keep proof and disclosures accurate                   |
| Submission/IP                 | **Confirmed:** team retains IP subject to third-party licenses; grants organizer/event partners a promotional license; submissions must be original/properly licensed and non-confidential ([Terms §6](https://www.hackmeridian.com/terms.html)) | Existing starter/AI attribution must remain         | Retain attribution, licenses, and baseline disclosure |

## E. Architecture decision

| Option                                                   | Effort                                                                            | Demo clarity                                               | Operational complexity                                                                                | Security risk                                         | Event relevance                                                                        | Decision                                                                |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1. Keep current Sui implementation unchanged             | Low implementation effort; current config still blocks core flow                  | Poor: no meaningful Stellar behavior                       | Low new complexity, but stale Sui deployments remain confusing                                        | Existing provenance/fallback/dependency risks         | Weak against the official “build on Stellar” direction                                 | Reject as HackMeridian entry strategy; keep only as historical baseline |
| 2. Keep Sui and add one meaningful Stellar feature       | Medium to high because two chains must be explained, configured, and demonstrated | Mixed: judges must understand which chain is authoritative | Highest: two wallets, two address formats, two explorers, two failure models, possible reconciliation | Cross-chain provenance and partial-authority mistakes | Could qualify only if the Stellar feature is genuinely central; easy to look bolted on | Not preferred for a two-person team                                     |
| 3. Port the core passport and repair workflow to Stellar | Medium/high but bounded when limited to one contract and adapter                  | Best: one chain owns the complete new demo                 | Moderate and controllable                                                                             | New contract risk, but one explicit trust boundary    | Directly demonstrates smart contracts and a Scale step toward product                  | **Recommended**                                                         |

The recommended architecture is a focused Stellar-native version, not a bridge. Keep `move/redevice/` and Git history as prior work. Change the active demo’s authoritative source to a Soroban contract and explicitly label any historical Sui reference as **legacy Sui evidence**, with original chain, package/object ID, transaction link, and an “imported reference—not Stellar-native and not independently reverified” notice.

Historical Sui records cannot be renamed, copied, or displayed as if Stellar validators created them. If migration of historical references becomes valuable later, commit a manifest hash on Stellar that points to an immutable export and records who performed the import. That proves the import attestation and file integrity, not the truth of the old physical-world claims or a continuous cross-chain state.

## F. Proposed Stellar design

### Focused system boundary

```text
Public browser ──read/simulate──> Stellar RPC ──> ReDevice Soroban contract
      │                                  │                 │
      └─ QR route: network + contract + device ID          ├─ roles/config
                                                           ├─ device entries
Authorized browser ──Freighter/passkey──sign──submit──────> └─ repair entries
      │
      └─ poll transaction to SUCCESS/FAILED; then read back durable state

Optional evidence bytes ──> external object store (later)
Contract stores only digest + reference + metadata; never provider credentials.
```

The React application should know Stellar through one service boundary. Components receive typed domain data and typed transaction states; they do not assemble XDR, poll RPC, or interpret contract storage themselves.

### Contract responsibilities and proposed interface

Use one Soroban contract for the hackathon. Avoid upgrade proxies, token contracts, bridges, and one-contract-per-device designs.

Proposed methods (names may follow the generated binding’s Rust/TypeScript conventions):

```text
initialize(admin: Address, schema_version: u32)

grant_role(admin: Address, role: Role, account: Address)
revoke_role(admin: Address, role: Role, account: Address)
replace_role(admin: Address, role: Role, old: Address, new: Address)
has_role(role: Role, account: Address) -> bool

register_device(
  registrar: Address,
  request_id: BytesN<32>,
  serial_commitment: BytesN<32>,
  manufacturer_namespace: String,
  brand: String,
  model: String,
  masked_serial: String,
  initial_status: LifecycleStatus
) -> u64

attest_repair(
  repairer: Address,
  request_id: BytesN<32>,
  device_id: u64,
  repair_type: RepairType,
  notes: String,
  next_status: LifecycleStatus,
  battery_health: Option<u32>,
  claimed_service_time: Option<u64>,
  evidence: Option<EvidenceRef>
) -> u32

get_device(device_id: u64) -> Device
get_device_by_commitment(commitment: BytesN<32>) -> Option<u64>
get_repair_count(device_id: u64) -> u32
get_repairs(device_id: u64, start: u32, limit: u32) -> Vec<RepairRecord>
get_request_result(actor: Address, request_id: BytesN<32>) -> Option<OperationResult>
```

The contract should return typed errors such as `AlreadyInitialized`, `Unauthorized`, `RoleAlreadyGranted`, `RoleNotGranted`, `DuplicateDevice`, `DeviceNotFound`, `DuplicateRequest`, `InvalidInput`, `InvalidTransition`, `InvalidBatteryHealth`, and `PageLimitExceeded`. Never use an error string as the authorization protocol.

### Authorization and administration

- Store the administrator address in instance storage. Each administrative call must execute `admin.require_auth()` and compare it with the stored administrator.
- Store role membership by `(Role, Address)` and require the actor’s auth inside `register_device` and `attest_repair`. A browser-supplied address without `require_auth()` is not authorization.
- Emit events for grant, revoke, replacement, registration, and repair. Include role/account or device/repair index as topics where appropriate.
- `replace_role` should atomically revoke the old account and grant the new one under administrator authorization. Tests must prove the old account immediately fails.
- For the MVP, administrator recovery is an explicit custody assumption, not a magical feature: use a controlled G-account, consider Stellar native multisig/thresholds only if the team can test it, and document that loss of every authorized signer can strand administration.
- Do not make the repair shop’s passkey smart account the system administrator during the hackathon. Keep optional user-experience experimentation separate from root authority.

### Device identity and serial commitment

Use a monotonically assigned contract-local `u64` as the compact device ID. The globally meaningful identity is `(network passphrase, contract address, device_id)`, not `device_id` alone.

Version the commitment algorithm and publish test vectors:

```text
SHA-256(
  "redevice:serial:v1" || 0x00 ||
  normalize(manufacturer_namespace) || 0x00 ||
  normalize(model_or_product_namespace) || 0x00 ||
  normalize(serial)
)
```

Define normalization narrowly (Unicode form, case, whitespace/hyphen treatment) rather than deleting all punctuation without explanation. The duplicate map is `serial_commitment -> device_id`. This avoids obvious cross-manufacturer collisions but remains vulnerable to offline guessing. Describe it as a public pseudonymous commitment, not anonymity. A secret pepper would make multi-registrar consistency, recovery, and public reproducibility harder; defer it until there is a real privacy model.

### Storage, pagination, TTL, and restoration

Stellar contract data is not permanent by default. Official documentation distinguishes `Temporary`, `Instance`, and `Persistent` storage, all with TTL behavior. Persistent/instance entries are archived when TTL expires and can be restored; temporary entries are deleted permanently.

Recommended layout:

| Data                                                        | Storage                                   | Key                     | Notes                                                                      |
| ----------------------------------------------------------- | ----------------------------------------- | ----------------------- | -------------------------------------------------------------------------- |
| Administrator, schema version, next device ID, page maximum | Instance                                  | small global keys       | Shared lifecycle with contract instance; extend contract code/instance TTL |
| Role membership                                             | Persistent                                | `(Role, Address)`       | Durable operational state; extend on admin change and role use             |
| Serial index                                                | Persistent                                | `Serial(BytesN<32>)`    | Maps commitment to device ID; extend when the device is touched            |
| Device                                                      | Persistent                                | `Device(u64)`           | Durable passport summary and repair count                                  |
| Repair                                                      | Persistent                                | `Repair(u64, u32)`      | One entry per record; no unbounded vector                                  |
| Request result/idempotency                                  | Persistent or bounded temporary by policy | `(Address, BytesN<32>)` | For event MVP, persistent gives reliable retry; revisit costs later        |

Enforce a small page maximum such as 20. Each repair is a separate entry because Stellar reads/writes a contract-data entry in full and official guidance warns against caller-growable collections under one key.

On every write, extend TTL for the contract instance/code and the touched role, device, serial index, repair, and request entry toward a documented threshold. Assign maintenance responsibility to the project administrator/operator: inspect TTLs and submit periodic extension operations. Keep an index of device/repair keys needed for maintenance. If a read encounters archived persistent state, show “record archived; restoration required,” construct/simulate the restoration-enabled transaction, and require an authorized fee payer rather than treating the record as nonexistent. Test TTL extension logic and at least one restoration scenario.

### Time and attestation semantics

Use `env.ledger().timestamp()` for `registered_at` and `attested_at`. This is the ledger close time and is authoritative for when the attestation was accepted by Stellar. Store an optional repairer-supplied service time separately as `claimed_service_time`, with a clear label. Reject a claimed time materially in the future relative to ledger time; allow older service dates only if the product wants retrospective claims. Never call the claimed date “verified time.”

### Events, durable records, and public reads

Publish typed `RoleChanged`, `DeviceRegistered`, and `RepairAttested` events. Events provide transaction-level evidence and help indexing, but they are not the only source of public history: default Stellar RPC event/transaction retention is bounded (commonly about seven days). The public UI must read durable contract entries for the passport and pagination. For the hackathon’s small data set, direct RPC reads/simulations are enough; a durable event indexer is post-hackathon unless enumeration/search becomes necessary.

After transaction `SUCCESS`, decode the return value/event, then read the device/repair entries back from the configured contract. Display both the transaction hash and contract address. If readback fails, retain the successful hash and say “confirmed; refresh unavailable.”

### Limits and idempotency

Proposed contract-enforced limits for the MVP should be finalized in tests, for example:

- manufacturer namespace, brand, model: 1–64 UTF-8 bytes each;
- masked serial: 4–32 bytes;
- repair notes: 1–500 bytes;
- evidence URL/reference: at most 256 bytes;
- evidence MIME type: allowlisted and at most 64 bytes;
- page limit: 1–20;
- battery health: `None` or 0–100 (0 is a real value, not “missing”);
- known lifecycle enum and an explicit transition matrix;
- no all-zero commitment or request ID.

The UI creates and persists a random 32-byte `request_id` before asking for a signature. Reusing it must return/locate the original result or fail as `DuplicateRequest` without a second write. Registration duplication by serial should return enough information, through a view, to locate the already-registered device safely.

### React, SDK, wallet, and network flow

Use the official `@stellar/stellar-sdk` for XDR, RPC, contract interaction, simulation, assembly, submission, and result decoding. Use `@stellar/freighter-api` for the conventional browser-wallet MVP. Freighter is an SDF-provided browser extension and the official docs describe React/dapp signing flows. Pin versions deliberately after a one-hour compatibility spike; do not copy an older tutorial’s package names or wallet-kit major version without checking its current API.

For each write:

1. Read the connected address and Freighter network; compare the network passphrase to Testnet before constructing the transaction.
2. Read the account sequence and build the single contract invocation with a short timeout.
3. Simulate through Stellar RPC. Treat simulation errors—including authorization and archival preambles—as first-class results.
4. Assemble the transaction with the simulated resources/fees.
5. Show network, contract, method, public fields, and estimated fee before requesting signature.
6. Ask Freighter to sign with the explicit Testnet network passphrase.
7. Submit through RPC. `sendTransaction` accepting/enqueuing a hash is **not** final success.
8. Persist the hash/request ID and poll `getTransaction` until `SUCCESS` or `FAILED`, with bounded backoff and a visible timeout/unknown state.
9. On success, decode result/events and read back state. On failure, decode a useful contract/RPC error without leaking raw internals as the only message.

Reads must not require a wallet. Configure a public Testnet RPC URL and a contract ID as public frontend values. Do not put secret keys, seed phrases, fee-payer keys, or object-store credentials in Vite variables—every `VITE_*` value is shipped to the browser.

### Chain-aware URLs and explorer proof

Use a canonical route such as:

```text
https://<demo-host>/passport/stellar-testnet/<CONTRACT_ADDRESS>/<DEVICE_ID>
```

QR payloads should use that route, with an optional compact versioned URI only if the scanner needs it. Validate the literal network slug, Stellar `C...` contract address, and numeric device ID. Never reuse Sui’s `0x` object-ID regex or assume a contract address identifies a device. Generate explorer links from the same checked network config; show `Stellar Testnet` next to every address and hash.

Later deployment documentation must record CLI/SDK versions, WASM hash, contract address, deployer/admin public address, network passphrase, RPC, deployment transaction hash, source commit, and exact build/test/deploy commands. Deployment is intentionally outside this audit.

### File-by-file migration map

| Existing path                      | Proposed path/action                                                                | Reason                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `move/redevice/**`                 | Preserve unchanged; add historical note                                             | Retain attribution and earlier implementation                              |
| —                                  | `stellar/contracts/redevice/Cargo.toml` and `stellar/contracts/redevice/src/lib.rs` | Focused Soroban contract                                                   |
| —                                  | `stellar/contracts/redevice/src/test.rs`                                            | Contract unit/auth/storage/idempotency tests                               |
| —                                  | `stellar/README.md` and `stellar/deployments/testnet.json`                          | Reproducible build/deployment record with public identifiers only          |
| `web/src/constants.ts`             | `web/src/config/stellar.ts`                                                         | Validated network/contract/explorer config; no silent production fallbacks |
| `web/src/dApp-kit.ts`              | `web/src/stellar/client.ts` and `web/src/stellar/wallet.ts`                         | SDK/RPC and Freighter boundary                                             |
| `web/src/data/sui-passport.ts`     | `web/src/stellar/redevice-service.ts`                                               | Typed reads, simulation, submit/poll/readback                              |
| `web/src/data/passport-adapter.ts` | Keep domain types; split fixtures from live decoders                                | Reuse UI model without misleading provenance                               |
| authorization hooks                | `use-stellar-role.ts`                                                               | Typed role/config/network states                                           |
| `DeviceRegistration.tsx`           | Adapt transaction call/result states                                                | Reuse accessible form, replace Sui assumptions                             |
| `RepairWorkspace.tsx`              | Adapt transaction/evidence states                                                   | Preserve core UX; require finality and idempotency                         |
| `QrPassportScanner.tsx`            | Replace Sui ID parser with route parser                                             | Network + contract + device identity                                       |
| `PassportQrDownload.tsx`           | Update route/copy/explorer and dependency                                           | Stellar proof; phone-safe canonical URL                                    |
| `TransactionStatusPreview.tsx`     | Map to simulation/sign/submission/finality/readback                                 | Accurate transaction lifecycle                                             |
| —                                  | `web/src/**/*.test.ts(x)`                                                           | Protect parsing, provenance, errors, and states                            |

Do not keep both chains behind a generic runtime abstraction during the event. A small domain interface (`getDevice`, `getRepairs`, `registerDevice`, `attestRepair`, `getRole`) is sufficient and testable.

## G. Mandatory MVP and optional differentiator

### Mandatory MVP definition

The MVP is done only when all of these are demonstrable on Stellar Testnet:

- [ ] An administrator has granted one registrar and one repairer on-chain.
- [ ] The authorized registrar registers a device through a signed contract invocation.
- [ ] Duplicate detection rejects the same versioned serial commitment and the UI can locate the existing device.
- [ ] A fresh/incognito browser opens the QR URL and reads the passport without a wallet.
- [ ] The authorized repairer adds an attestation and the public history changes only after final `SUCCESS` and readback.
- [ ] An unrelated address and a revoked repairer are rejected by the contract, not merely hidden by the frontend.
- [ ] Every screen and explorer link says Stellar Testnet and identifies the contract.
- [ ] Transaction hash, contract event/return value, and durable record agree.
- [ ] Evidence is either absent or truthfully described as a digest/reference with explicit availability limits.
- [ ] UI copy says signatures prove who attested and ledger inclusion—not that a physical repair occurred.
- [ ] Clean install, contract tests, frontend tests, typecheck, production build, and a rehearsed network-failure fallback pass.

### Preferred optional addition: passkey-based repair-shop smart account

Passkeys are a good product fit because repair technicians should not handle seed phrases for routine attestations, and smart accounts are a published HackMeridian technical priority. They are still optional because they introduce another contract/account, fee payer, origin rules, recovery, and discovery.

**Current official tooling assessment (checked 13 October 2026):** Stellar smart wallets implement `__check_auth`; Stellar supports the WebAuthn-common `secp256r1` curve on-chain. Official docs list two sibling TypeScript approaches, not drop-in versions of one library. Smart Account Kit targets OpenZeppelin Smart Accounts and policy rules. Passkey Kit ships a different wallet contract and states that its contract/SDKs have not been independently audited. Official docs say the earlier Launchtube relay is retired and point new projects to OpenZeppelin Relayer.

**Preferred spike:** use OpenZeppelin Smart Account plus Smart Account Kit, following the current official example, for one repairer account. Do not write a new `__check_auth` implementation. Timebox feasibility to 2 hours; budget 10–18 additional person-hours only after MVP.

**Browser/domain constraints:** WebAuthn credentials are scoped to a relying-party ID/origin. A passkey created on `localhost` is not the production-domain credential. Use one stable HTTPS demo domain before enrolling the demo repairer. Test Safari/Chrome on the actual laptop/phone pair. Synced passkeys depend on the user’s platform account and policy; hardware-bound credentials behave differently.

**Recovery and discovery:** register a secondary signer or documented recovery policy at account creation. Losing the only passkey must not silently strand the shop. Persist or deterministically discover the smart-account contract address; localStorage alone is not account discovery. A tiny registry keyed by a non-sensitive user handle may be needed, but do not publish raw credential IDs casually.

**Fees and fallback:** a contract account cannot be the transaction source and cannot sign the envelope; a G-account must pay/submit. The reliable fallback is a conventional funded Freighter G-account with the same on-chain repairer role. If passkey onboarding fails during the demo, switch transparently to Freighter rather than changing authorization rules.

**Sponsored transactions:** if a relayer pays fees, its key lives only in a server-side secret store. The service must accept only an allowlisted ReDevice contract, network, and methods; rebuild/inspect the transaction; validate actor auth entries and short expirations; run enforcing-mode simulation; cap resource fees; rate-limit by account/IP; enforce request IDs; and reject arbitrary XDR, destinations, token transfers, or contract upgrades. Set daily/testnet budgets and an emergency off switch. Sponsorship is optional and should not delay the MVP.

Repair payments/escrow and cross-chain transfers are later alternatives. They add real user value only when there is a defined payer/payee, dispute model, asset, fee/trust model, and supported infrastructure. They are not needed to prove the passport/attestation value proposition and should not be mandatory hackathon scope.

## H. Evidence-storage plan

### Decision: explicitly defer uploads from the mandatory MVP

For the core demo, evidence should be `None` or an explicitly external reference. Do not preserve `demo-evidence://filename`, and do not call file selection an upload.

If the team has 8–16 hours after the mandatory demo is stable, add a small provider-backed flow:

1. Restrict to PDF, JPEG, PNG, and WebP; maximum 10 MB; verify MIME and magic bytes server-side.
2. Hash the exact file bytes in the browser with SHA-256 before upload. Ten megabytes is small enough for Web Crypto without building a streaming hash implementation for the event.
3. Request a short-lived signed upload URL from a server endpoint. Provider credentials stay server-side; never place them in `VITE_*` or the contract.
4. Store under an immutable content-addressed key such as `evidence/<sha256>` with overwrite disabled. Record provider URL/CID, SHA-256, byte size, MIME type, and a version in `EvidenceRef`.
5. After upload, fetch the stored bytes or provider checksum and confirm the digest before enabling the on-chain attestation.
6. The public viewer shows four separate states: `verified hash and available`, `available but hash mismatch`, `reference recorded but unavailable`, and `no evidence`.

All MVP evidence is public and must exclude full serials, invoices, names, addresses, faces, customer documents, credentials, and other personal data. Provider retention and availability are external dependencies; a contract hash does not keep bytes online. If private evidence is later required, design encryption, consent, deletion/retention, authorized key distribution, and breach response before uploading anything.

A matching document hash proves only that the retrieved bytes match the bytes an attester committed to. It does not prove that the document is truthful, that a part is genuine, or that a physical repair occurred.

## I. Testing and definition of done

### Tests that already exist and were executed

| Existing test/check    | Result on 13 October 2026                             | What it establishes                                                                                                                         | What it does not establish                                                                |
| ---------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Move unit tests (7)    | Pass                                                  | package version; unique registration; duplicate rejection; unauthorized registrar; authorized repair; unauthorized repair; revoked repairer | Deployed IDs, UI integration, input bounds, registrar revocation, browser/wallet behavior |
| Move build             | Pass with six `public entry` lint warnings            | Audited source compiles on Sui CLI 1.76.0                                                                                                   | Deployment or transaction success                                                         |
| `npm run typecheck`    | Pass using original checkout’s installed dependencies | TypeScript source typechecks                                                                                                                | Clean install reproducibility or runtime behavior                                         |
| `npm run build`        | Pass using Vite 8.1.5                                 | Production bundle can be emitted                                                                                                            | Browser/wallet/mobile correctness; build warns about 903.58 kB main chunk                 |
| `npm run format:check` | Fail                                                  | Prettier scans `web/dist` and reports eight generated files                                                                                 | It did not identify source-format failures in the reported list                           |
| Clean `npm ci`         | Fail (`EUSAGE`)                                       | Root lock is out of sync                                                                                                                    | No dependency tree was installed in the clean worktree                                    |
| npm audit              | Fail                                                  | Committed lock: 3 high; installed/current local lock: 1 critical + 3 high                                                                   | Raw severity is not proof that every vulnerable API is reachable                          |

### Future contract tests

- Valid registration stores the exact versioned commitment, ledger timestamp, registrar, and initial status.
- Unauthorized and revoked registrars cannot register.
- Valid repair stores both claimed service time and ledger attestation time.
- Unauthorized and revoked repairers cannot attest.
- Role replacement revokes the old address atomically.
- Duplicate serial commitment returns/reveals the existing device without a second write.
- Duplicate request ID cannot duplicate registration or repair.
- Empty and oversized manufacturer/model/masked serial/notes/evidence fields fail.
- Invalid battery values and lifecycle transitions fail; `None` and real 0% remain distinct.
- Multiple devices and repairers do not share state accidentally.
- Page size and page boundaries work with more repairs than one page.
- Wrong contract/network inputs cannot decode as a ReDevice record.
- TTL extension thresholds are exercised; archived persistent state produces the expected restoration path.
- Events contain the returned device/repair identifiers and actor.

### Future frontend/service tests

- Public passport and paginated repairs render with no wallet API present.
- Correct passport identification comes from contract return/event, never the first changed item.
- Wrong network is detected before simulation/signing.
- Rejected wallet signature returns to a retryable draft with no success claim.
- Simulation failure, `sendTransaction` error, `PENDING`, final `FAILED`, polling timeout, and successful final confirmation are distinct states.
- Reload resumes a submitted hash/request ID; retry never duplicates a write.
- Final success plus readback failure retains the hash and truthful status.
- Malformed/oversized QR input, wrong network, wrong contract, missing device, and archived device show distinct errors.
- QR generated from the canonical host opens on another phone/computer; localhost warning is tested.
- Camera permission denied/unavailable and pasted ID fallback work; QR-image upload is either implemented/tested or not claimed.
- Evidence hash match, mismatch, unavailable reference, too-large file, and wrong file type are handled.
- Recorded/offline fixture never shows a live/verified badge.
- Keyboard operation, focus visibility, labels, status announcements, contrast, reduced motion, 375 px layout, and no horizontal overflow receive a basic accessibility/mobile pass.

### Definition of done

The hackathon build is done when a clean clone installs deterministically; automated checks pass; one Testnet device and repair can be created through the UI; unauthorized and revoked attempts fail on-chain; the passport opens wallet-free from a second device; transaction hash/contract event/state agree; network and limitations are visible; and the team can complete the live script twice consecutively plus the offline fallback without changing configuration manually.

“Deployed,” “submitted,” or “the UI rendered” alone is not done.

## J. Two-person implementation plan

The owner labels describe work streams, not assumed expertise. At kickoff, assign **Owner A** to the contract-first stream and **Owner B** to the frontend-first stream, then require cross-review at each integration checkpoint. If actual strengths are reversed, swap the labels.

### Rule gate and pre-event preparation

The official site explicitly shows “Before: Learn + prepare” and permits existing projects, but it does not define whether new event implementation may be written before 25 October. Until organizers answer, treat implementation timing as a gate.

**Preparation that is clearly consistent with the published language or is low-risk, but should still be disclosed:**

- preserve the baseline commit and inventory pre-existing code;
- read Stellar/Soroban/Freighter documentation and complete tutorials outside the submission branch;
- install/pin candidate tooling locally and verify versions;
- write architecture, normalization test vectors, issue list, demo fixtures, and manual test scripts;
- prepare accounts with Testnet funds without deploying the submission contract;
- repair the general clean-install/dependency baseline only if organizers confirm whether those commits count as pre-event work;
- rehearse roles, communication, and timeboxes.

**Do not assume permitted until answered:** the Soroban contract, Stellar adapter, wallet integration, Testnet deployment, or any judged feature implementation.

### Work packages

| WP                                                | Owner                             | Work and acceptance criterion                                                                                                           |  Effort | Dependencies / checkpoint                                             |
| ------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------: | --------------------------------------------------------------------- |
| 0. Rules and baseline                             | A + B                             | Organizer answers recorded; baseline SHA and pre-existing feature list published; event changelog template ready                        |   1–2 h | First gate                                                            |
| 1. Reproducible toolchain                         | B, reviewed by A                  | One root lock; clean `npm ci`; pinned Stellar packages; test runner/CI skeleton; no high/critical reachable runtime advisory            |   3–6 h | May be pre-event only if permitted; checkpoint C1                     |
| 2. Soroban model and auth                         | A, reviewed by B                  | Initialize, roles, grant/revoke/replace, `require_auth`, bounded device/repair structures, typed errors; negative tests pass            |  8–12 h | WP0; checkpoint C2: contract tests                                    |
| 3. Identity, pagination, TTL, events, idempotency | A                                 | Versioned commitment vectors; separate repairs; page cap; request results; TTL extension; typed events                                  |   6–9 h | WP2; may reduce to essentials if time                                 |
| 4. Stellar frontend boundary                      | B                                 | Validated network config; RPC/SDK service; Freighter address/network; simulate/sign/send/poll/readback state machine                    |  8–12 h | WP1 plus stable contract ABI; checkpoint C3                           |
| 5. Public passport and QR                         | B                                 | Wallet-free device/history read; canonical chain-aware route; phone-safe QR/PDF; typed unavailable/wrong-network states                 |   5–8 h | WP3/4; checkpoint C4: second-device read                              |
| 6. Registration and repair integration            | A + B                             | One registration and repair succeed on Testnet; unauthorized and revoked attempts fail; UI resumes by hash/request ID                   |  6–10 h | WPs 2–5; checkpoint C5: minimum live demo                             |
| 7. Test, docs, and demo hardening                 | A + B                             | Required automated/manual matrix passes; deployment manifest, README, AI/event changelog, explorer proof, live/offline scripts complete |  6–10 h | C5; final freeze                                                      |
| Optional passkey                                  | Whichever core stream frees first | One repairer smart account works on stable HTTPS with recovery/fallback; no custom crypto                                               | 10–18 h | Only after C5 twice                                                   |
| Optional evidence upload                          | Other owner                       | Real bytes, hash verification, signed upload, unavailable state, privacy controls                                                       |  8–16 h | Only after C5 twice; mutually exclusive with passkey if time is tight |

**Mandatory core total:** approximately 43–69 person-hours including setup and hardening. The low end is feasible for two people across focused preparation plus the event; completing it entirely during two event days is risky. If pre-event feature coding is disallowed, use the scope cuts below and target roughly 32–44 person-hours during the event.

### Critical path

```text
Organizer rule gate
  -> clean toolchain
  -> contract auth + device + repair tests
  -> Testnet deploy + checked manifest
  -> SDK transaction service
  -> registration and wallet-free read
  -> repair + finality/readback
  -> unauthorized/revoked demo
  -> QR on second device
  -> docs, proof, fallback, final freeze
```

### Suggested event sequence, 25–26 October

**Day 1 morning:** confirm rules and submission format; tag the event-start commit. Owner A implements/tests the minimal contract. Owner B finishes clean frontend tooling, domain fixtures, network config, transaction-state tests, and canonical route without inventing live data.

**Day 1 afternoon/evening:** freeze the ABI; deploy once to Testnet; record the manifest; integrate authorized registration and wallet-free read. Minimum end-of-day milestone: contract tests pass, one real device is registered, and an incognito browser reads it by canonical URL with correct Testnet/contract labels.

**Day 2 morning:** integrate repair attestation, finality polling, readback, unauthorized and revoked cases, and second-device QR. Do not start optional work until the minimum live demo succeeds twice.

**Day 2 afternoon:** failure states, accessibility/mobile smoke checks, test evidence, README/specs, event changelog, explorer links, timed demo, offline fallback, and submission packaging. Freeze code early enough to recover from RPC/wallet trouble.

### Scope cuts, in this order

1. Cut passkeys and sponsored fees; use Freighter and funded Testnet G-accounts.
2. Cut all evidence upload; allow no evidence and explain it.
3. Cut QR-image upload; retain canonical QR generation, native phone-camera opening, and pasted route/ID.
4. Cut PDF regeneration if the QR itself works; a printed/static code is enough.
5. Use CLI/admin script for grant/revoke rather than an admin dashboard, but keep on-chain tests and event proof.
6. Show only the latest 20 repairs in the UI while preserving contract pagination.
7. Cut historical Sui imports, search, owner transfers, payments, escrow, and cross-chain behavior entirely.

Never cut on-chain authorization, duplicate protection, wallet-free read, finality handling, network labeling, or the unauthorized/revoked demonstration. Those are the product’s credibility.

### Post-hackathon hardening

- Independent contract/security review, threat model, fuzzing, and deployment/upgrade policy.
- Production RPC/indexer choice, observability, rate limits, incident response, and TTL maintenance automation.
- Administrator multisig/recovery and repair-shop lifecycle operations.
- Private-evidence/legal/privacy design and provider durability.
- Performance/code splitting, broader browser automation, accessibility audit, localization, and production UX research.
- Only then evaluate mainnet, payments, escrow, ownership transfer, or historical import attestation.

## K. Partner handoff and demonstration guide

### Plain-English project explanation

ReDevice gives a second-hand electronic device a public service passport. A trusted registrar creates the device entry; a trusted repair shop signs later service claims; a buyer scans a QR code to inspect the history without creating an account. The chain proves which authorized account made a record and when the network accepted it. It does not inspect the device or prove that the physical repair really happened.

Today’s repository implements that idea on Sui, with a polished frontend and a tested Move contract, but the checked-in deployment IDs no longer form one working deployment. The HackMeridian version should keep the product experience and port the core trust rules to Stellar rather than trying to restore the old Sui demo.

### Current local setup and audit-verified commands

Requirements declared by the repo are Node >=22.12 and npm 11. The audit used Node 22.18.0 and npm 11.6.2.

```bash
cd /Users/azatcharyyev/Projects/redevice
npm install
npm run dev
```

`npm run dev` is the checked root script. However, **a clean deterministic `npm ci` currently fails because the committed root lock is stale**. `npm install` was not run by this audit because it would modify that tracked lock. Before handing a fresh clone to a partner, fix and commit RDEV-011 on the future implementation branch and prefer:

```bash
npm ci
npm run typecheck
npm run build
npm run format:check
```

The audit executed typecheck (pass), build (pass with a large-chunk warning), format check (fail on generated `web/dist` files), Move build (pass with lint warnings), and seven Move tests (all pass). It also briefly verified that this direct workspace command starts Vite:

```bash
npm run dev --workspace @redevice/web -- --host 127.0.0.1
```

Do not use `npm run dev -- --host ...` through the current root wrapper: npm does not forward those extra arguments to Vite correctly. For LAN access, use the direct workspace form below.

### What a partner can see

- The overall page, registration shell, QR scanner shell, public passport layout, repair timeline layout, and wallet controls render locally.
- A real public passport needs a reachable Sui Testnet RPC and a compatible passport object.
- Registration needs a Sui wallet plus the configured active `RegistrarCap`; the checked-in default is wrong.
- Repair submission needs a Sui wallet, configured `RepairerCap`, package-compatible passport, fees, signing, and RPC; the checked-in passport/package pair is incompatible.
- QR/PDF generation is client-side. Camera scanning needs browser permission and a secure context.
- The built-in fallback is not proof of a live record and must not be presented as one.

For the future Stellar version, public views must need only RPC/network/contract/device configuration. Registration/repair require a funded Testnet wallet (or later smart account/relayer). Public frontend configuration—network passphrase/name, RPC URL, contract ID, explorer base, schema version, and canonical site origin—is not secret. Administrator/fee-payer keys, object-store credentials, and any recovery material are private server/operator secrets and must never enter source, Vite variables, logs, or screenshots.

### Phone or second-computer access

`localhost` always means the device opening the URL. A QR containing `http://localhost:5173` generated on a Mac tells a phone to open port 5173 on the phone, so it will fail.

On a trusted local network, start Vite with:

```bash
npm run dev --workspace @redevice/web -- --host 0.0.0.0
```

Open `http://<MAC_LAN_IP>:5173` on the Mac **before generating the QR**, so the QR captures the reachable host. The OS firewall must allow the connection and both devices must share the network. Plain HTTP on a LAN IP is generally not a secure context, so the web page’s own camera scanner may remain unavailable on the phone; the phone’s native camera can still scan a QR that opens the page. For the in-app camera and passkeys, use a stable HTTPS demo origin prepared later under the event rules. This audit did not publish or expose a server.

### Short live-demo script

1. **Problem (20 seconds):** “A second-hand buyer sees repair claims but cannot tell who attested to them or whether they changed.”
2. **Public view (40 seconds):** on a phone/incognito browser with no wallet, scan the canonical QR and show model, masked serial, Stellar Testnet/contract identity, coverage start, current status, and existing repair timeline.
3. **Trust boundary (30 seconds):** explain that serial commitment prevents duplicate registration under the documented scheme and that signatures prove attestation, not physical truth.
4. **Authorized repair (60–90 seconds):** connect the authorized repairer, show the exact public fields/network/contract, simulate, sign, submit, wait for final `SUCCESS`, open the explorer transaction, and show the refreshed record with ledger attestation time.
5. **Negative case (40 seconds):** switch to an unrelated or revoked address and show the contract rejecting the same operation. Make clear this is on-chain enforcement, not a hidden button.
6. **Evidence and limitations (20 seconds):** show no evidence or a digest/reference state and explain availability/integrity versus physical truth.
7. **Close (20 seconds):** “ReDevice turns repair claims into attributable, portable records buyers can inspect without joining a marketplace.”

### Network-failure fallback (clearly labeled)

Keep a locally bundled, timestamped **recorded demo snapshot** with its real Testnet contract address, device ID, successful/failed transaction hashes, and screenshots/video captured before submission. The app must display a persistent “Recorded demonstration—network unavailable; not a live read” banner and disable signing. Open explorer links if the public network is reachable. Never silently swap in fixture data under a live badge.

### Positioning statement

> ReDevice gives buyers of refurbished electronics a wallet-free QR passport whose service records can only be added by currently authorized repair shops on Stellar. It makes repair claims attributable and tamper-evident while remaining honest that a blockchain signature does not prove physical work.

Do not claim official EU integration, regulatory compliance, proof of physical repair, permanent evidence availability, production security, or prize eligibility.

## L. Submission checklist and organizer questions

### Submission-readiness checklist

- [ ] Category confirmed with organizer; both team members registered/accepted.
- [ ] Event-start baseline tag/commit and pre-existing Sui feature inventory published.
- [ ] Event changelog identifies every contract/frontend/test/document added during the judged window.
- [ ] README explains the user problem, architecture, trust boundaries, public route, setup, test, and demo.
- [ ] Soroban specification documents roles, methods, errors, storage, TTL, limits, idempotency, and evidence semantics.
- [ ] Public Testnet network passphrase/name, RPC, contract ID, WASM hash, deployment transaction, admin public address, source commit, and explorer links recorded.
- [ ] Clean `npm ci`; pinned Rust/Stellar tooling; reproducible contract build and deploy instructions.
- [ ] Contract and frontend test output saved; unauthorized/revoked/duplicate proof included.
- [ ] Reproducible demo fixture uses non-sensitive synthetic devices and unique serial inputs.
- [ ] Public QR opens on a second device without a wallet.
- [ ] Demo script and explicitly labeled network-failure recording/snapshot rehearsed.
- [ ] Repository/public-access requirement verified before changing visibility.
- [ ] Video, slide, pitch-length, hosting, and submission fields completed only to verified requirements.
- [ ] `AI_USAGE.md` updated with event dates, prompts/files, human decisions, and human verification; organizer-specific AI disclosure added if required.
- [ ] Mysten starter, Sui work, open-source libraries, Stellar/OpenZeppelin tooling, AI assistance, and third-party services attributed.
- [ ] Existing-project disclosure says ReDevice began as a Sui prototype and identifies the exact pre-event baseline.
- [ ] No secrets, personal data, seed phrases, private keys, real customer documents, or environment files in Git, demo, logs, video, or submission.
- [ ] Final source commit and deployed contract agree; no uncommitted dependency/deployment drift.

### Draft organizer questions — do not send automatically

1. ReDevice is an existing Sui prototype that we plan to port meaningfully to Stellar. Should we apply in Scale, and is any additional existing-project disclosure required?
2. What exact code, tests, design, scaffolding, and Testnet deployment work may be completed before the 25 October kickoff? What must be created during the event?
3. Should we tag an event-start baseline, and how will judges distinguish pre-existing UI/domain work from the Stellar implementation built for HackMeridian?
4. What is the final project submission deadline and timezone?
5. Which submission platform is used, who may submit for a team, and must every member have an account?
6. Must the repository be public? Must it be created during the event, and are multiple repositories permitted?
7. Is a live demo, prerecorded video, slide deck, or specific pitch duration required? What are the hosting and maximum-duration rules?
8. What are the judging criteria and weights? The FAQ points to the Build page, but the current Build page does not show them.
9. What is the final prize breakdown between Genesis and Scale? Are there sponsor bounties or technical requirements beyond the three published priorities?
10. Are smart contracts, smart accounts, and cross-chain transfers preferences, scoring factors, or eligibility requirements? Are they separate prizes?
11. Is a two-person team permitted, and what is the maximum team size?
12. AI-assisted development is allowed; is there a required disclosure format or list of tools/prompts?
13. Are Testnet contracts acceptable for judging, and are there supported RPC, explorer, smart-account, or relayer services the organizers want teams to use?
14. Are travel/venue schedules, mentorship checkpoints, and presentation slots published anywhere participants should monitor?

## M. Sources, commands, and audit limitations

### Official event sources checked 13 October 2026

- [HackMeridian home](https://www.hackmeridian.com/)
- [HackMeridian Build](https://www.hackmeridian.com/build)
- [HackMeridian FAQ](https://www.hackmeridian.com/faq)
- [HackMeridian Terms of Service](https://www.hackmeridian.com/terms.html)
- [HackMeridian Bizzabo application page](https://events.bizzabo.com/949257) — accessible page exposed no detailed rules to the browser used for this audit
- [Meridian event details](https://meridian.stellar.org/event-details)

### Official technical sources checked 13 October 2026

- [Stellar smart-contract getting started](https://developers.stellar.org/docs/build/smart-contracts/getting-started)
- [Soroban host-managed authorization example](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/auth)
- [Freighter wallet guides](https://developers.stellar.org/docs/build/guides/freighter)
- [Freighter transaction signing](https://developers.stellar.org/docs/build/guides/freighter/prompt-to-sign-tx)
- [Smart wallets and current passkey tooling](https://developers.stellar.org/docs/build/guides/contract-accounts/smart-wallets)
- [Persisting contract data](https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/persisting-data)
- [Choosing a storage type](https://developers.stellar.org/docs/build/guides/storage/choosing-the-right-storage)
- [State archival and restoration](https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival)
- [Publishing contract events](https://developers.stellar.org/docs/build/guides/events/publish)
- [Transaction simulation](https://developers.stellar.org/docs/build/guides/transactions/simulateTransaction-Deep-Dive)
- [`sendTransaction` RPC](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/sendTransaction)
- [`getTransaction` RPC](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getTransaction)
- [Signing Soroban invocations](https://developers.stellar.org/docs/build/guides/transactions/signing-soroban-invocations)
- [Official example-app SDK overview](https://developers.stellar.org/docs/build/apps/example-application-tutorial/overview)

### Commands and outcomes

| Command/check                                               | Environment                                         | Exit/result               | Meaning                                                                                                                               |
| ----------------------------------------------------------- | --------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `git fetch --prune origin`                                  | verified `Ihlasthetics/redevice` origin             | 0                         | Local `main` and fresh `origin/main` both `74fb0fd`; no fetched `origin/developer`                                                    |
| Git status/ref/history inspection                           | original checkout                                   | —                         | Original `main` had a modified root lock and five untracked deployment/build artifacts; isolated worktree used; nothing stashed/reset |
| `npm ci --ignore-scripts --no-audit`                        | clean audited worktree, Node 22.18.0, npm 11.6.2    | 1 `EUSAGE`                | Committed root lock and package manifests are out of sync                                                                             |
| `npm run typecheck`                                         | original checkout’s existing installed dependencies | 0                         | TypeScript passes; result is limited by uncommitted local lock/install state                                                          |
| `npm run build`                                             | same; Vite 8.1.5                                    | 0, warning                | Build passes; largest main chunk 903.58 kB minified / 281.62 kB gzip; jsPDF chunk 398.40 kB                                           |
| `npm run format:check`                                      | same                                                | 1                         | Eight generated `web/dist` files were checked and failed formatting; add `.prettierignore`/narrow scope later                         |
| `npm audit --json`                                          | clean committed lock                                | 1                         | Three high transitive advisories; stale lock omits declared jsPDF/QR graph                                                            |
| `npm audit --json`                                          | installed tree/uncommitted corrected lock           | 1                         | One critical aggregate (`jspdf`) and three high transitives (`js-yaml`, `nanoid`, `source-map-js`)                                    |
| `npm ls jspdf js-yaml nanoid source-map-js --all`           | installed tree                                      | 0                         | Confirmed versions and dependency paths used in RDEV-012                                                                              |
| `sui move build`                                            | Sui 1.76.0-homebrew, isolated worktree              | 0 with warnings           | Move package builds; no deployment                                                                                                    |
| `sui move test`                                             | same                                                | 0; 7/7 pass               | Existing Move unit tests pass; lint warnings remain                                                                                   |
| `sui client object ... --json`                              | active env `testnet`, read-only                     | 0 for queried objects     | Confirmed checked/default and recent local public object types; no signing or transaction                                             |
| `npm run dev --workspace @redevice/web -- --host 127.0.0.1` | original checkout                                   | started; manually stopped | Direct workspace dev command reaches Vite ready state; no browser/wallet validation                                                   |
| Secret-pattern scan                                         | tracked audited worktree                            | no candidate secret found | Documentation mentions secret terms; no matching credential material detected. This is not a complete secret audit                    |

### Limitations and unresolved assumptions

- The report audits commit `74fb0fdc097aa044f250379a1b48d1720b168c65`. The user’s unrelated modified root lock and untracked deployment receipts/Move lock were preserved and excluded from the documentation commit.
- Recent local deployment receipts were inspected only for public transaction/object IDs and types. They indicate a newer Sui deployment but do not establish a complete usable frontend configuration or live passport.
- No real browser visual review, screen-reader test, phone layout/camera test, wallet signing, rejected signature, insufficient-fee case, or end-to-end transaction was performed.
- Read-only Sui object lookups verify type/existence at one point in time, not ownership safety, complete state, or future Testnet availability.
- No Stellar code or deployment exists in this audited repository, and this audit deliberately did not implement one.
- The event website may change before 25 October. Prize split, sponsor rules, criteria, deadlines, submission format, team maximum, video requirements, and the pre-event code boundary remain unverified and must be rechecked in official participant communications.
- Official technical documentation is current to the access date, but package versions/APIs should be pinned only after a fresh compatibility check at implementation time.
- Estimates are person-hours for a focused prototype, not production/security guarantees.

## Ordered actionable checklist

1. **Ask the organizers** the 14 questions in section L; do not begin judged Stellar implementation until the pre-event boundary is clear.
2. **Record the baseline** `74fb0fdc097aa044f250379a1b48d1720b168c65`, disclose the existing Sui prototype, and create an event-work changelog.
3. **Apply to/confirm Scale** unless the organizers direct the team elsewhere; do not claim acceptance or prize eligibility from this report.
4. **Fix reproducibility on the future implementation branch:** one root lock, clean `npm ci`, deliberate dependency updates, targeted Prettier scope, and CI.
5. **Freeze the Stellar MVP contract interface:** roles, replacement, device, separate repairs, bounds, pagination, request IDs, events, TTL, and typed errors.
6. **Implement contract tests first,** including unauthorized, revoked, duplicate, invalid/oversized, pagination, idempotency, and TTL behavior.
7. **Deploy one Testnet contract** only when authorized by the event rules; commit a public deployment manifest tied to source/WASM hashes.
8. **Build the narrow Stellar service** with validated network/contract provenance and simulate -> sign -> submit -> poll -> readback states.
9. **Complete the vertical slice:** authorized registration, duplicate lookup, wallet-free public read, authorized repair, unauthorized/revoked rejection, and final explorer proof.
10. **Generate a canonical phone-safe QR** and verify it from an incognito second device with no wallet.
11. **Keep evidence honest:** no fake upload; either omit it or add digest/reference states. Add real storage only after the core demo passes twice.
12. **Rehearse live and offline demos,** with the offline snapshot permanently labeled as recorded/non-live.
13. **Cut passkeys first if time slips;** add the OpenZeppelin-based smart-account spike only after every mandatory MVP checkbox passes.
14. **Finish submission evidence:** README/specs, tests, AI/third-party attribution, event-work diff, contract/network IDs, limitations, and verified platform/video fields.
15. **Freeze early, inspect for secrets and unrelated files,** tag the final commit, verify the deployed contract matches it, and submit before the official deadline/timezone.
