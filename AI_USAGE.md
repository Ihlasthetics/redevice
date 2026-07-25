# AI usage disclosure

ReDevice uses ChatGPT Codex as a development assistant. The two team members
direct product decisions, review the generated work, run and verify the
application, test real wallet flows, and present the project.

## Initial scaffold

AI-assisted on 25 July 2026:

- repository and workspace structure
- conversion of the official Sui starter into the ReDevice monorepo
- placeholder landing shell and design tokens
- initial Move package boundary
- documentation, product specification and contribution workflow

The frontend began with Mysten Labs'
`@mysten/create-dapp@0.7.11` `react-e2e-counter` template. Reused setup:

- React, TypeScript, Vite and Tailwind configuration
- Mysten dApp Kit provider and wallet connection pattern
- Sui TypeScript code generation configuration
- small button/card utility patterns

Removed or replaced:

- all counter-specific Move and React behavior
- counter package IDs and generated bindings
- starter README and example copy

## Ongoing rule

For each AI-assisted milestone, append:

```text
Date:
Tool:
Human direction and decisions:
Files assisted:
Human verification:
```

Prompts that materially direct implementation belong in `specs/prompts/`.
Never include secrets or wallet recovery information in prompts or commits.

## Public passport layout

Date: 25 July 2026

Tool: ChatGPT Codex

Human direction and decisions: The frontend owner approved a first milestone
limited to the wallet-free public passport summary and explicitly deferred the
repair timeline, evidence links, repair workspace and blockchain integration.

Files assisted:

- `web/src/App.tsx`
- `web/src/index.css`
- `web/src/data/passport-adapter.ts`

Human verification: The frontend owner reviewed and approved the milestone
scope and authorized the commit and push. Automated formatting, type checking
and production build checks were run before commit. The owner then pulled the
branch, ran the app locally and visually verified the public passport layout.

## Repair history timeline

Date: 25 July 2026

Tool: ChatGPT Codex

Human direction and decisions: The frontend owner approved a second milestone
limited to the repair history timeline and its evidence and Explorer resource
states. Real Walrus and Sui URLs remain deferred to testnet integration, so the
sample records do not claim to be onchain.

Files assisted:

- `web/src/App.tsx`
- `web/src/data/passport-adapter.ts`
- `AI_USAGE.md`

Human verification: The frontend owner approved the milestone scope. Automated
formatting, type checking and production build checks passed. Visual verification
on the owner's Mac remains pending after commit and pull.

## Limited-history warning

Date: 25 July 2026

Tool: ChatGPT Codex

Human direction and decisions: The frontend owner approved completing all
remaining frontend requirements without separate milestone approval gates
because of the hackathon deadline. The warning explicitly states that repairs
before the passport coverage date are unknown.

Files assisted:

- `web/src/App.tsx`
- `AI_USAGE.md`

Human verification: Automated formatting, type checking and production build
checks were run before commit. Visual verification on the owner's Mac remains
pending after transfer.
