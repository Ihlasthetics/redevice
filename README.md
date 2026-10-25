# ReDevice

ReDevice gives refurbished electronics a public passport and repair history on Stellar Testnet. Connected wallets create device records, authorized repairers append service attestations, and anyone can read a passport through a link or QR code without connecting a wallet. An on-chain attestation proves which account submitted a record and when; it does not independently prove that physical work occurred.

## Current status — 25 October 2026

| Item                  | Status                                                             |
| --------------------- | ------------------------------------------------------------------ |
| Public app            | [redevice-six.vercel.app](https://redevice-six.vercel.app)         |
| Network               | Stellar Testnet                                                    |
| Contract              | `CCHXDDGMOZNABGIYGBOIWCFHD3RECIKI2UWJKMOGRBCSSIL6YACCX6WJ`         |
| Reviewed WASM SHA-256 | `538b6343ce351890bb53fcb27b6f8c1075b5af2eb9dead3debf06cc0b9004d70` |
| Administrator         | `GBYKDBAWYNIVU24MVH2ENOYFLSU7LXRNHFWJ7WOPF3Q76C3MDV5SWCLD`         |

This contract accepts registration from any connected Testnet wallet. Repair attestations still require an administrator-granted Repairer role. It currently contains device **1** with one repair. The earlier contract (`CDSP64KAEVFZ5QU3U2AMTNFWWF3CHEXRCFBSXWDESF6QSR3SHU2CWZCT`) also retains its own device **1** and repair history at [the earlier app](https://redevice-delta.vercel.app); its registration rule is unchanged.

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

A revised contract that draws distinct five digit IDs is built and uploaded on Testnet with WASM SHA-256 `d5d3a7c0e9a92af5ff41b949ad28745bb9572143243076e4d11e91df456914eb`. It is **not yet the production contract**. The current contract still assigns sequential IDs and contains device 1 with one repair. The new code requires a new contract instance because the current contract has no upgrade function. The `/deploy` page can read back the uploaded WASM before the administrator signs instance deployment. Five digit IDs are public and can be guessed; they are not access secrets.

## Test the hosted app

1. Open [the app](https://redevice-six.vercel.app) and look up device `1` on the current contract.
2. Open `/register` to find a passport or register a device. Install Freighter, select **Test Net**, connect and fund a Testnet account, then approve the registration transaction. No Registrar role is needed.
3. To authorize a repairer, open `/admin`, connect the contract administrator wallet, enter the repairer's `G…` address, and select **Grant Repairer**. Approve both Freighter prompts and wait for the confirmed transaction. The repairer then opens `/repairer` to attest a repair, or use passport lookup and registration.
4. Open a passport link or QR code on a second device to check the public experience. Hosted links use the HTTPS Vercel origin; a localhost QR link is not reachable from another device.

Test data and repair notes are public on Testnet. Do not put private information in them. A repairer only needs to share a **public `G...` address** to receive a role; never share a recovery phrase or private key.

## Run locally

Requirements: Node.js 22.12.0 or newer, npm, and Freighter for signed actions.

```sh
npm ci
cp web/.env.example web/.env.local
```

Set the following public value in `web/.env.local`, then start Vite:

```dotenv
VITE_STELLAR_CONTRACT_ID=CCHXDDGMOZNABGIYGBOIWCFHD3RECIKI2UWJKMOGRBCSSIL6YACCX6WJ
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

The latest local checks passed: **39 browser tests** and **13 contract tests**. Contract checks use Rust 1.99.1, the `wasm32v1-none` target, and Stellar CLI 28.1.0:

```sh
cargo fmt --manifest-path stellar/Cargo.toml --check
cargo test --manifest-path stellar/Cargo.toml --locked
stellar contract build --manifest-path stellar/Cargo.toml --package redevice-stellar --locked
```

Vercel builds from the repository root with [vercel.json](vercel.json). The personal Vercel project's production `VITE_STELLAR_CONTRACT_ID` points to the current sequential-ID contract. The [ignore file](.vercelignore) excludes local environment files and contract build artifacts. The optional `/deploy` page handles a reviewed WASM upload, fee-bump signing, instance deployment, and a Repairer role grant. The five digit WASM is already uploaded: use **Check existing upload** before any repeat upload. Set `VITE_FIVE_DIGIT_IDS=true` only when production points to the new contract.

## Remaining work

- Register a device from an account without roles, and test repair attestations from a separately authorized real repairer.
- Test unauthorized and revoked repair writes and phone QR scanning.
- Exercise interrupted transaction recovery and archived-entry restoration on Testnet.
- Record registration and repair transaction hashes in the deployment record. Vercel is not yet linked to GitHub.

See [the Stellar integration plan](docs/stellar_integration.md) for the schema, test gates, and remaining migration details. The earlier Sui prototype remains in Git history; its records are not presented as Stellar records.

The passkey feasibility harness is documented in the [passkey-sponsored actions roadmap](docs/passkey_sponsored_actions.md), with [Vercel Preview setup](docs/passkey_vercel_preview.md). Its real Testnet passkey transaction and reusable layer still require proof.
