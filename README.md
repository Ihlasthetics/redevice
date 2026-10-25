# ReDevice

ReDevice gives refurbished electronics a public passport and repair history on Stellar Testnet. Authorized registrars create device records, authorized repairers append service attestations, and anyone can read a passport through a link or QR code without connecting a wallet. An on-chain attestation proves which account submitted a record and when; it does not independently prove that physical work occurred.

## Current status — 25 October 2026

| Item                  | Status                                                             |
| --------------------- | ------------------------------------------------------------------ |
| Public app            | [redevice-delta.vercel.app](https://redevice-delta.vercel.app)     |
| Network               | Stellar Testnet                                                    |
| Contract              | `CDSP64KAEVFZ5QU3U2AMTNFWWF3CHEXRCFBSXWDESF6QSR3SHU2CWZCT`         |
| Reviewed WASM SHA-256 | `77bb782f87eee60ad687fa78cf31c4b2e221e4a12469ce657438a1d3ef2d22d0` |
| Administrator         | `GD4EBGIWGRWV53KWC5UVLCKDIXTGLFDJKRBEATB7B3SUXJWNWT2KYLJT`         |

The contract and both roles are live. Akif registered a device and attested a repair through the local browser. Public Testnet reads confirm device **1** and its **one repair record**. The hosted homepage and direct passport route respond over HTTPS. Yhlas's independent wallet and phone QR flow still need testing.

The current Vercel deployment came from the local `hackathon/stellar-migration-akif` checkout. It is not connected to the GitHub repository, and these migration changes have not been pushed. Later code changes require another deployment to update the hosted app.

## What works

- Freighter connects on Testnet and checks the connected account's on-chain roles.
- A registrar can register a device. The browser hashes the normalized full serial; the contract stores its commitment and rejects duplicates. The full serial is not submitted. A serial commitment can still be guessed from likely serials, so it is not anonymous.
- A repairer can append a repair with public notes, a lifecycle change, optional battery health, and an optional claimed service time. The contract records its own ledger timestamp separately.
- Anyone can read a passport and paged repair history without a wallet. The app provides passport URLs, QR codes, camera scanning, PDF export, and explorer links.
- Registration and repair requests have stable request IDs, and the browser waits for final transaction status. The contract has role revocation, input limits, lifecycle rules, and storage TTL extension.

### Roles today

| Role          | On-chain permission                                    |
| ------------- | ------------------------------------------------------ |
| Administrator | Grant, revoke, and replace Registrar or Repairer roles |
| Registrar     | Register devices                                       |
| Repairer      | Attest repairs on registered devices                   |
| No role       | Read public records                                    |

The contract requires the actor's signature **and** active role for every write; disabling a browser button is only a user interface aid. Akif's account is currently Administrator, Registrar, and Repairer because it was used for the first end-to-end test. The roles can be assigned to separate accounts without changing the contract. The `/deploy` page can grant roles to its connected administrator account, but a general admin screen for other addresses and revocation is still needed. Any authorized repairer can currently attest a repair on any registered device; there is no per-device assignment.

## Test the hosted app

1. Open [the app](https://redevice-delta.vercel.app) and read device ID `1` without connecting a wallet.
2. To test a write, install Freighter, select **Test Net**, connect an account that has the relevant role, and approve the transaction in Freighter. Only Akif's account currently has both write roles.
3. Open a passport link or QR code on a second device to check the public experience. Hosted links use the HTTPS Vercel origin; a localhost QR link is not reachable from another device.

Test data and repair notes are public on Testnet. Do not put private information in them. Yhlas only needs to share his **public `G...` address** to receive a role; never share a recovery phrase or private key.

## Run locally

Requirements: Node.js 22.12.0 or newer, npm, and Freighter for signed actions.

```sh
npm ci
cp web/.env.example web/.env.local
```

Set the following public value in `web/.env.local`, then start Vite:

```dotenv
VITE_STELLAR_CONTRACT_ID=CDSP64KAEVFZ5QU3U2AMTNFWWF3CHEXRCFBSXWDESF6QSR3SHU2CWZCT
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

The latest local checks passed: **26 browser tests**, **1 fee-bump construction test**, and **12 contract tests**. Contract checks use Rust 1.99.1, the `wasm32v1-none` target, and Stellar CLI 28.1.0:

```sh
cargo fmt --manifest-path stellar/Cargo.toml --check
cargo test --manifest-path stellar/Cargo.toml --locked
stellar contract build --manifest-path stellar/Cargo.toml --package redevice-stellar --locked
```

Vercel builds from the repository root with [vercel.json](vercel.json). Set `VITE_STELLAR_CONTRACT_ID` as a build environment variable for each CLI deployment. The [ignore file](.vercelignore) excludes local environment files and contract build artifacts. The optional `/deploy` page handles a reviewed WASM upload, fee-bump signing, instance deployment, and initial role grants. The current contract is already deployed: use **Check existing upload** before any repeat upload. Stellar Lab's ordinary upload form could not represent the original WASM upload fee; the fee-bump flow succeeded on Testnet.

## Remaining work

- Give Yhlas's Testnet account the Repairer role, remove that role from Akif when the separate-account test is ready, and add admin controls for managing other public addresses.
- Test Yhlas's wallet on the hosted app, an unrelated account's rejected writes, role revocation, and phone QR scanning.
- Exercise interrupted transaction recovery and archived-entry restoration on Testnet.
- Record public upload, deployment, role, registration, and repair transaction hashes in the deployment record. Push and review the migration branch when the team is ready; Vercel is not yet linked to GitHub.

See [the Stellar integration plan](docs/stellar_integration.md) for the schema, test gates, and remaining migration details. The earlier Sui prototype remains in Git history; its records are not presented as Stellar records.
