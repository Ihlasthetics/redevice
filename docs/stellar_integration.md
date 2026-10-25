# Stellar integration plan

HackMeridian work starts from `main` at `9e41f617aeaad999efca967da472d166e03b97fb` on 25 October 2026. The active repository is now Stellar-only; the earlier prototype remains in Git history. Yhlas's public-experience PR #10 predates this migration and needs a careful manual port rather than a direct merge.

**Current milestone:** the reviewed contract is live on Stellar Testnet, Akif completed a registration and repair through the local browser, public RPC reads return device 1 and its repair, and the browser is hosted at [redevice-delta.vercel.app](https://redevice-delta.vercel.app). The Vercel project was deployed from the local checkout and is not connected to GitHub. Yhlas's separate account, cross-device passport viewing, and phone QR scanning remain to be tested.

## Scope and working rules

- The MVP is one Soroban contract and one focused Stellar client, not a bridge, payment feature, or generic multichain framework.
- Work on `hackathon/stellar-migration-akif`. The team authorized the Testnet deployment and Vercel publication during the hackathon. Do not push or create a PR until requested, and never use wallet secrets in the repository or deployment environment.
- Finish and verify each phase before starting the next. Coordinate any public UI work with Yhlas because PR #10 targets the removed pre-migration page.
- Record the source commit, network, contract ID, WASM hash, deployment transaction, and demo transactions. The contract ID and WASM hash are recorded below; public transaction hashes and a final source commit still need to be collected. Secret keys never belong in the deployment record.

## Phase 1 — identity and schema

The device identity is `(Stellar network passphrase, contract address, contract-local u64 device ID)`. The human URL uses `stellar-testnet`, and the client validates it against the Testnet passphrase and a valid `C...` contract address. The device ID is a decimal integer, not a Sui object ID.

The versioned serial-commitment preimage and test vectors are below. The browser computes the commitment; the contract only sees the 32-byte hash and cannot prove that the registrar used the claimed raw serial. The commitment is public and guessable, not anonymous. Display names are separate from normalized namespaces. Contract timestamps use Unix **seconds**; `claimed_service_time` and ledger `attested_at` are distinct fields.

**Gate met:** schema, normalization, vectors, invalid-input tests, and route rules are documented. No Sui object ID is accepted as a Stellar identity.

### Version 1 serial commitment

The registrar supplies a manufacturer namespace and product namespace separately from the public brand/model labels. Each namespace is NFKC-normalized, trimmed, ASCII-lowercased, 1–64 characters, and restricted to lowercase letters/digits separated by single `.`, `_`, or `-` characters. The raw serial is NFKC-normalized, trimmed, ASCII-uppercased, 1–128 characters, and restricted to letters/digits separated by single `.`, `_`, `-`, or `/` characters. Interior spaces and all other characters are rejected rather than silently removed. The normalized serial is never submitted or logged.

The preimage is UTF-8 bytes of `redevice:serial:v1`, one zero byte, the normalized manufacturer namespace, one zero byte, the normalized product namespace, one zero byte, and the normalized serial. SHA-256 of those bytes is the 32-byte public commitment. Hyphens, slashes, dots, and underscores remain significant. This only enforces client-side consistency: the contract cannot attest to the physical serial behind a submitted hash.

| Manufacturer | Product        | Serial       | SHA-256 commitment                                                 |
| ------------ | -------------- | ------------ | ------------------------------------------------------------------ |
| `lenovo`     | `thinkpad-t14` | `PF-123/AB9` | `34d758d5c722dbb8650d8fc1cc19fefa53b84fe12e9e0bfe9bea99b6f7018d58` |
| `fairphone`  | `fairphone-5`  | `ABC123456`  | `37c8357d35f2e1858436b455e305e987661d040e63f1dbf28bd095e6fce43785` |

The canonical public path is `/passport/stellar-testnet/<valid-C-contract-address>/<decimal-device-id>`. IDs start at 1, have no leading zeroes, and fit in unsigned 64 bits. Contract addresses require a valid Stellar StrKey checksum, not a `C`-prefix regex. The route parser uses the official SDK's StrKey validation and rejects a Sui `0x` object ID, other network slug, malformed contract address, or oversized/ambiguous ID.

## Phase 2 — contract rules, locally

The contract at `stellar/contracts/redevice/` has a deployment-time constructor for the administrator, avoiding a public first-caller initialization race. It requires actor authorization inside every privileged method and stores registrar and repairer roles on-chain, including revocation. It implements unique serial commitments, bounded fields, lifecycle transitions, optional battery health, and ledger timestamps. Each repair is stored separately and exposed in pages capped at 20.

This phase was built in two validated slices: (2a) administrator, roles, unique registration, and registration-request replay; then (2b) repair attestations, repair-request replay, pagination, events, and TTL tests. On 25 October 2026, public Testnet RPC reported protocol 29, so the contract pins `soroban-sdk` 29.0.1 rather than a protocol-30 release candidate. Recheck the live protocol before a future contract upgrade.

Registration and repair use a persistent `(actor, request ID)` result so a repeated request returns its original result without another write. A repeated ID with different arguments fails. The serial index, device, repair, role, and request data use persistent storage; touched entries and the contract instance have their TTL extended. An operator-led archival/recovery procedure still needs documentation and testing; a passive public read alone cannot be assumed to restore archived data.

**Gate met locally:** contract tests cover authorized and rejected calls, duplicate registration, revocation, invalid fields and transitions, two repair pages, repeat request IDs, and exact claimed-versus-ledger timestamps. On 25 October, 12 native tests passed and Stellar CLI 28.1.0 built the SDK-29 contract with Rust 1.99.1. The reviewed WASM was then uploaded and invoked on Testnet. The toolchain and CLI are under `/tmp` in this checkout, not installed for the team globally.

## Phase 3 — Testnet vertical slice

**25 October deployment result:** Stellar Lab could not build the upload because its ordinary transaction fee field is limited to `uint32`. The `/deploy` page used a protocol-23+ fee-bump envelope to upload the reviewed 16,617-byte WASM. Public Testnet RPC reads now confirm contract `CDSP64KAEVFZ5QU3U2AMTNFWWF3CHEXRCFBSXWDESF6QSR3SHU2CWZCT` runs WASM SHA-256 `77bb782f87eee60ad687fa78cf31c4b2e221e4a12469ce657438a1d3ef2d22d0`. The administrator `GD4EBGIWGRWV53KWC5UVLCKDIXTGLFDJKRBEATB7B3SUXJWNWT2KYLJT` holds Registrar and Repairer roles. A readback bug after the successful upload was fixed; the page now accepts a hex hash and can detect existing code without repeating the upload. Record the public upload, deployment, and role transaction hashes from the wallet or explorer when available. Freighter's Testnet passphrase is `Test SDF Network ; September 2015`.

Akif registered device 1 and attested one repair through the browser; public RPC reads return both records. Next, perform an unrelated-account and revoked-repairer negative test through the contract, not only through disabled UI controls. Record public transaction evidence; never copy signing material into the repo.

**Gate met:** unsigned public RPC reads return device 1 and its repair from Testnet. The disconnected-browser and cross-device checks remain in Phase 4.

## Phase 4 — browser integration

The browser uses `@stellar/stellar-sdk` and Freighter for authorized signing, with wallet-free reads. It validates the configured network and contract ID before a write and distinguishes configuration or RPC failures from missing authorization. Registration, repair, authorization checks, passport mapping, QR/PDF routes, and explorer links use Stellar. The earlier runtime was removed at the team's request; the browser shows a clear unconfigured state if the contract ID is missing.

**Current state:** the browser has wallet-free reads, Freighter role checks and signing, registration, repair attestation, Stellar routes, camera QR scanning, PDF generation, and explorer links. The `/deploy` page handled the live upload, deployment, and initial role grants. The browser is hosted at [redevice-delta.vercel.app](https://redevice-delta.vercel.app), and its public homepage and passport deep link respond over HTTPS. Akif reported successful registration and repair locally. Yhlas's wallet, disconnected-browser read, phone QR scan, and unauthorized/revoked-account scenarios remain unverified. The admin UI can only grant roles to its own connected account; managing another account and revocation requires additional UI or a direct contract call. Port selected visual improvements from PR #10 only after review.

## Phase 5 — finality and retention

Simulate, assemble, sign, submit, and poll to final `SUCCESS` or `FAILED`; `PENDING` is not success. Preserve the transaction hash if readback fails. Persist a random request ID before signing and reuse it on retry. Distinguish confirmed ledger state, failed readback, failed transaction, and unknown finality in the UI. Exercise TTL extension and an archived-entry recovery path on Testnet when practical.

**Gate:** interruption and retry cannot append a second repair; a confirmed hash survives refresh failure; a failed or unknown transaction is never labeled confirmed.

**Current local state:** the browser persists request IDs by account, contract, and submitted fields, and the SDK polls for transaction completion. A submitted hash is surfaced on unknown finality. Archived-entry recovery and an actual interrupted-write Testnet rehearsal remain pending.

## Verification and scope cuts

- Run `cargo fmt --manifest-path stellar/Cargo.toml --check`, `cargo test --manifest-path stellar/Cargo.toml --locked`, and `stellar contract build --manifest-path stellar/Cargo.toml --package redevice-stellar --locked` before deployment. The contract CI job pins Rust 1.99.1 and Stellar CLI 28.1.0 and runs on `stellar/**` changes.
- Run `npm ci`, `npm run format:check`, `npm run typecheck`, `npm test`, `npm run build`, and `npm audit --audit-level=high` at the repo root after frontend changes.
- Repeat the successful Akif Testnet flow with Yhlas's separate funded account and an incognito/phone HTTPS QR read. Mocked tests and CLI reads do not prove his wallet or camera behavior.
- Defer evidence uploads, payments, passkeys, historical Sui import, generic multichain abstractions, and production indexing until the core slice passes.

Current Stellar tooling behavior must be checked against [Stellar contract documentation](https://developers.stellar.org/docs/build/smart-contracts), [Stellar CLI documentation](https://developers.stellar.org/docs/tools/cli), and [state archival documentation](https://developers.stellar.org/docs/build/guides/archival) before each implementation step.
