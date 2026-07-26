# ReDevice

**Verifiable device passports and repair histories for second-hand electronics, built on Sui.**

ReDevice is an ETHGlobal Lisbon 2026 prototype that gives each registered device a public, QR-accessible passport. Buyers can inspect a device's identity, current condition, verified coverage date, and repair history without creating an account or connecting a wallet.

Authorized registrars create passports, and authorized repairers append service attestations. ReDevice makes those records transparent and tamper-evident while clearly distinguishing verified on-chain history from earlier or unverified physical-world claims.

> ReDevice verifies who signed a record, when it was added, and that it was not silently changed. It does not prove that a physical repair occurred.

## Why ReDevice?

Second-hand electronics often come with incomplete, editable, or fragmented service records. ReDevice provides:

- public passport access through a QR code, pasted QR content, or passport link
- device identity, masked serial number, current lifecycle status, and verified-history start date
- capability-gated device registration and repair workflows
- append-only repair attestations stored in a shared Sui object
- duplicate registration protection using a locally hashed serial number
- downloadable QR passport PDFs
- independent object and transaction inspection through SuiVision

## How it works

1. An authorized registrar connects a Sui wallet and creates a device passport.
2. The full serial number is hashed locally; only the hash and a masked serial are submitted.
3. The shared `DeviceRegistry` rejects a second passport for the same serial hash.
4. A buyer scans the device QR code or opens its passport link without connecting a wallet.
5. An authorized repairer signs a repair attestation.
6. The Move contract validates the repairer's active `RepairerCap`, appends the record, and updates the device lifecycle status.
7. The frontend reloads the shared `DevicePassport` from Sui Testnet.

## Authorization model

ReDevice uses Sui Move capabilities rather than treating any connected wallet as trusted:

| Capability | Purpose |
| --- | --- |
| `AdminCap` | Grants or revokes registrar and repairer capabilities |
| `RegistrarCap` | Allows its assigned wallet to create device passports |
| `RepairerCap` | Allows its assigned wallet to append repair attestations |

Capabilities can be revoked without removing their audit trail. Unauthorized wallets, revoked repairers, invalid lifecycle states, invalid battery-health values, and duplicate serial hashes are rejected on-chain.

## Current prototype

The prototype currently supports:

- live reads and transactions on **Sui Testnet**
- wallet-based registrar and repairer workflows
- QR scanning, QR-image upload, pasted QR content, and passport URLs
- public, wallet-free passport viewing
- repair history with service type, notes, condition change, battery health, timestamps, repairer address, and evidence reference
- QR passport PDF generation
- SuiVision links for objects and transactions
- automatic passport refresh after confirmed repair transactions

Evidence is currently stored as a reference field. ReDevice does **not** claim a production Walrus upload or official EU registry integration.

## Testnet deployment

| Resource | ID |
| --- | --- |
| Package | `0xd960ddb62abcbf29d916639debf1ddb9e2e110140b7f4e897f1922f64c5dcf60` |
| Device registry | `0x63db08a5932edad48c36bdfe33b7a447276ccfd8b4fb55ef6157b596f10eeb5a` |
| Demo passport | `0xc1e9a7e28afc26bccf67cae9ea29807d7961bc3d1f922f9aa8f7156c03c46666` |

These values are prototype defaults and can be overridden through Vite environment variables.

## Tech stack

- **Smart contracts:** Sui Move
- **Frontend:** React 19, TypeScript, Vite, and Tailwind CSS
- **Sui integration:** Mysten dApp Kit and `@mysten/sui`
- **Data fetching:** TanStack Query
- **QR and PDF:** `jsQR`, `qrcode`, and `jsPDF`
- **Explorer:** SuiVision Testnet

## Project structure

```text
redevice/
├── move/redevice/        # Sui Move package and tests
├── web/                  # React, TypeScript, Vite, and Tailwind frontend
├── specs/                # Product specifications and AI prompts
├── docs/                 # UX and engineering guidance
├── AI_USAGE.md           # AI-assistance disclosure
└── CONTRIBUTING.md       # Contribution and Git workflow
```

## Requirements

- Node.js 22.12 or newer
- npm 11 or newer
- Sui CLI configured for testnet
- a Sui-compatible wallet with testnet enabled for authorized actions

Public passport viewing does not require a wallet.

## Run locally

Install dependencies and start the frontend:

```bash
npm install
npm run dev
```

Create an optional `web/.env.local` file to override the checked-in testnet defaults:

```dotenv
VITE_SUI_PACKAGE_ID=YOUR_PACKAGE_ID
VITE_SUI_PASSPORT_ID=YOUR_PASSPORT_ID
VITE_SUI_REPAIRER_CAP_ID=YOUR_REPAIRER_CAP_ID
VITE_SUI_REGISTRAR_CAP_ID=YOUR_REGISTRAR_CAP_ID
VITE_SUI_ADMIN_CAP_ID=YOUR_ADMIN_CAP_ID
VITE_SUI_REGISTRY_ID=YOUR_DEVICE_REGISTRY_ID
VITE_SUI_REPAIRER_ADDRESS=YOUR_REPAIRER_ADDRESS
VITE_SUI_ISSUER_ADDRESS=YOUR_ISSUER_ADDRESS
```

## Validate the project

Frontend:

```bash
npm run build
npm run typecheck
npm run format:check
```

Move package:

```bash
cd move/redevice
sui move build
sui move test
```

## Digital Product Passport context

ReDevice is inspired by the European Union's Digital Product Passport direction: durable product identity, QR-based access, traceable product information, and support for repair and circular use.

ReDevice is an independent hackathon prototype. It is not connected to the official EU Digital Product Passport Registry and does not claim regulatory compliance.

- [European Commission — Digital Product Passport](https://single-market-economy.ec.europa.eu/single-market/digital-product-passport_en)
- [European Commission — Digital Product Passport Registry is now live](https://single-market-economy.ec.europa.eu/news/digital-product-passport-registry-now-live-2026-07-20_en)

## Starter and attribution

The frontend began from Mysten Labs' `@mysten/create-dapp@0.7.11` `react-e2e-counter` starter. Counter-specific code was removed. The retained setup includes React, TypeScript, Vite, Tailwind CSS, Mysten dApp Kit, Sui code-generation configuration, and reusable UI primitives.

See [AI_USAGE.md](AI_USAGE.md) for the AI-assistance disclosure and [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow.
