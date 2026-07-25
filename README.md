# ReDevice

ReDevice helps buyers of refurbished electronics verify who inspected or
repaired a device, when the work happened, and whether the supporting evidence
was later changed.

This repository was started during ETHGlobal Lisbon 2026 for the Classic
From-Scratch track.

## MVP

- Represent each device passport as a Sui object.
- Grant verified repair permissions with a Move capability.
- Append repair records only from authorized wallets.
- Store public, non-sensitive repair evidence on Walrus.
- Let buyers read a passport without connecting a wallet.
- Demonstrate an unauthorized update being rejected onchain.

## Project structure

```text
redevice/
├── move/redevice/        # Sui Move package
├── web/                  # React, TypeScript, Vite and Tailwind frontend
├── specs/                # Product specifications and AI prompts
├── docs/                 # UX and engineering guidance
├── AI_USAGE.md           # AI-assistance disclosure
└── CONTRIBUTING.md       # Branch and commit workflow
```

## Work split

- `contract/move`: device passport, repairer capability, tests and deployment
- `frontend/ui`: public passport, repair workspace and responsive UI
- integration: completed together after the contract API is stable

Avoid editing the other person's area until integration. Shared files such as
`package.json` should be changed deliberately and announced first.

## Requirements

- Node.js 22.12 or newer
- npm 11 or newer
- Sui CLI configured for testnet
- Slush wallet with testnet enabled

## Run the web app

```bash
npm install
npm run dev
```

Build it with:

```bash
npm run build
```

## Work on the Move package

```bash
cd move/redevice
sui move build
sui move test
```

The package is not published in this scaffold. Testnet package and object IDs
will be added only after the contract and its authorization tests are ready.

## Starter and attribution

The frontend structure began from Mysten Labs'
`@mysten/create-dapp@0.7.11` `react-e2e-counter` starter. Counter-specific code
was removed. The retained setup includes React, TypeScript, Vite, Tailwind,
Mysten dApp Kit, Sui code generation configuration, and small reusable UI
primitives.

See [AI_USAGE.md](AI_USAGE.md) for AI-assisted work and
[CONTRIBUTING.md](CONTRIBUTING.md) for the required Git workflow.
