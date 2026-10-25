# ReDevice

ReDevice gives refurbished electronics a public passport and repair history on Stellar Testnet. Connected wallets create device records, authorized repairers append service attestations, and anyone can read a passport through a link or QR code without connecting a wallet. An on-chain attestation proves which account submitted a record and when; it does not independently prove that physical work occurred.

## Current status — 25 October 2026

| Item                  | Status                                                             |
| --------------------- | ------------------------------------------------------------------ |
| Public app            | [redevice-six.vercel.app](https://redevice-six.vercel.app)         |
| Network               | Stellar Testnet                                                    |
| Contract              | `CBR76DY4ZIRCB2CK5A2V7CC4I4UF7SQ5ULUHT6HMP4ZWN3R32BWAOIQP`         |
| Reviewed WASM SHA-256 | `583425b1943ce3656c5a0ada771911a7b4522151c799bc8cbc723b6fdd1a812e` |
| Administrator         | `GBYKDBAWYNIVU24MVH2ENOYFLSU7LXRNHFWJ7WOPF3Q76C3MDV5SWCLD`         |

This contract accepts registration from any connected Testnet wallet and issues five digit device IDs. Repair attestations require an administrator-granted Repairer role. The previous sequential-ID contract (`CCHXDDGMOZNABGIYGBOIWCFHD3RECIKI2UWJKMOGRBCSSIL6YACCX6WJ`) retains its device **1** and repair history on Testnet; those records are not part of the current contract.

The personal Vercel project `yhlas/redevice` is deployed from this checkout. It is not connected to GitHub; later code changes require another deployment.

## What works

- Freighter connects on Testnet and checks the connected account's on-chain roles.
- Any connected Testnet wallet can register a device. The browser hashes the normalized full serial and automatically publishes a mask (the last three characters for serials of at least six characters; shorter serials are fully hidden). The contract stores the commitment and mask and rejects duplicates. The full serial is not submitted. A serial commitment can still be guessed from likely serials, so it is not anonymous. Registration is a wallet-signed claim, not proof of ownership.
- A repairer can append a repair with public notes, a lifecycle change, optional battery health, and an optional claimed service time. The contract records its own ledger timestamp separately.
- Anyone can read a passport and paged repair history without a wallet. The app provides passport URLs, QR codes, camera scanning, PDF export, and explorer links.
- Registration and repair requests have stable request IDs, and the browser waits for final transaction status. The contract has role revocation, input limits, lifecycle rules, and storage TTL extension.

### Roles today

| Role          | On-chain permission                       |
| ------------- | ----------------------------------------- |
| Administrator | Grant, revoke, and replace Repairer roles |
| Repairer      | Attest repairs on registered devices      |
| No role       | Register devices and read public records  |

The contract requires the actor's signature for registration and both a signature and active Repairer role for repair attestations. The connected Yhlas wallet is the new contract's administrator. The dedicated `/admin` screen checks, grants, and revokes Repairer access for a Testnet wallet address after verifying the connected administrator wallet. Freighter prompts for the Soroban authorization signature and the transaction signature. Any authorized repairer can currently attest a repair on any registered device; there is no per-device assignment. The legacy Registrar enum remains in the contract interface but is not checked for registration.

The `/register` screen shows passport lookup and device registration. The `/repairer` screen includes those actions and adds repair attestation only while the connected wallet has an active Repairer role. A wallet without that role never sees the repair form, even when opening `/repairer` directly. The app restores an already authorized Freighter Testnet wallet when navigating between screens.

The single public address is [redevice-six.vercel.app](https://redevice-six.vercel.app). It currently points to the latest Vercel Preview deployment so the token-gated passkey sponsor can run without copying secrets into another environment. The old Preview alias was removed. Registration derives IDs from the browser's random request ID, so simulation and submission use the same storage key. The previous five-digit contract `CBT2G6GG5BYRV7DFCECIOVZXHAVH3UQWK2KSYUA7CXZY34H7TQ74N3OM` is broken; transaction `52ee226f9ffed287bf8cb9583f69a31e70eebf91fcbdaadec3f1f3edb501ee1a` failed because its PRNG chose a different key after simulation. Existing passports stay with their original contracts. Five-digit IDs are public and can be guessed; they are not access secrets.

## Test the hosted app

1. Open [the app](https://redevice-six.vercel.app) and register a device to receive a new five digit ID, or look up an existing ID on the current contract.
2. Open `/register` to find a passport or register a device. Install Freighter, select **Test Net**, connect and fund a Testnet account, then approve the registration transaction. No Registrar role is needed.
3. To authorize a repairer, open `/admin`, connect the contract administrator wallet, enter the repairer's `G…` or passkey `C…` address, and select **Grant Repairer**. Approve both Freighter prompts and wait for the confirmed transaction. The repairer then opens `/repairer` or `/passkey-spike` as appropriate.
4. Open a passport link or QR code on a second device to check the public experience. Hosted links use the HTTPS Vercel origin; a localhost QR link is not reachable from another device.

Test data and repair notes are public on Testnet. Do not put private information in them. A repairer only needs to share a **public `G...` or `C...` address** to receive a role; never share a recovery phrase or private key.

## Run locally

Requirements: Node.js 22.12.0 or newer, npm, and Freighter for signed actions.

```sh
npm ci
cp web/.env.example web/.env.local
```

Set the following public value in `web/.env.local`, then start Vite:

```dotenv
VITE_STELLAR_CONTRACT_ID=CBR76DY4ZIRCB2CK5A2V7CC4I4UF7SQ5ULUHT6HMP4ZWN3R32BWAOIQP
VITE_FIVE_DIGIT_IDS=true
```

```sh
npm run dev
```

The app opens at the URL Vite prints, usually `http://localhost:5173`. `VITE_PUBLIC_APP_ORIGIN` is optional; set it to a reachable HTTPS origin for a fixed QR domain. All `VITE_` values are included in the public browser build, so they must never contain secrets.

## Checks and deployment

```sh
npm run format:check
npm run typecheck
npm test
npm run test:fee-bump
npm run build
```

The latest local checks passed: **39 browser tests** and **14 contract tests**. Contract checks use Rust 1.99.1, the `wasm32v1-none` target, and Stellar CLI 28.1.0:

```sh
cargo fmt --manifest-path stellar/Cargo.toml --check
cargo test --manifest-path stellar/Cargo.toml --locked
stellar contract build --manifest-path stellar/Cargo.toml --package redevice-stellar --locked
```

Vercel builds from the repository root with [vercel.json](vercel.json). The canonical `redevice-six.vercel.app` alias points to the latest Preview deployment. Its `VITE_STELLAR_CONTRACT_ID` and server-only `PASSKEY_REDEVICE_CONTRACT_ID` point to the corrected five-digit contract, with `VITE_FIVE_DIGIT_IDS=true`. The [ignore file](.vercelignore) excludes local environment files and contract build artifacts. The optional `/deploy` page handles a reviewed WASM upload, fee-bump signing, instance deployment, and a Repairer role grant. The corrected WASM is also available from the page's download link.

## Remaining work

- Register a device from an account without roles, and test repair attestations from a separately authorized real repairer.
- Test unauthorized and revoked repair writes and phone QR scanning.
- Exercise interrupted transaction recovery and archived-entry restoration on Testnet.
- Record registration and repair transaction hashes in the deployment record. Vercel is not yet linked to GitHub.

See [the Stellar integration plan](docs/stellar_integration.md) for the schema, test gates, and remaining migration details. The earlier Sui prototype remains in Git history; its records are not presented as Stellar records.

The passkey feasibility harness is documented in the [passkey-sponsored actions roadmap](docs/passkey_sponsored_actions.md), with [Vercel Preview setup](docs/passkey_vercel_preview.md). A tester completed account creation, administrator grant, sponsored repair, and passport readback on the earlier sequential-ID contract; transaction hashes remain to be recorded. The reusable layer is still future work.
