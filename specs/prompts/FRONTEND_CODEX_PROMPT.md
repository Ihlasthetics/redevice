# Prompt for the frontend teammate's Codex

Copy everything below into Codex after cloning the repository.

---

You are implementing the frontend UI/UX for ReDevice in the
`Ihlasthetics/redevice` repository during ETHGlobal Lisbon 2026.

First read these files completely:

- `README.md`
- `CONTRIBUTING.md`
- `AI_USAGE.md`
- `specs/PRODUCT_SPEC.md`
- `docs/UI_UX_BRIEF.md`

Your ownership is `web/` UI code on branch `frontend/ui`. Do not edit `move/`,
root configuration, `web/src/dApp-kit.ts`, or `web/src/constants.ts` unless you
stop and ask first.

Before changing code:

1. Run `git status -sb` and confirm the tree is clean.
2. Run `git switch main && git pull --ff-only`.
3. Create or switch to `frontend/ui`.
4. Run `npm install`, `npm run typecheck`, and `npm run build`.
5. Explain your implementation plan and ask me before making any product choice
   that conflicts with the specs.

Build a polished, responsive UI for:

1. Public device passport readable without a wallet.
2. Repair history timeline and evidence links.
3. Limited-history/unknown-before-coverage warning.
4. Authorized repairer workspace and repair form.
5. Clear pending, confirmed, and unauthorized/rejected transaction states.

Use typed mock data behind a single adapter so blockchain integration can
replace it later. Do not implement fake blockchain behavior or claim that mock
records are onchain. Do not add a backend, database, AI, marketplace, Seal, or
zkLogin.

Visual direction: calm editorial repair report; warm off-white, near-black
green, restrained emerald; clear hierarchy and generous spacing. Avoid generic
crypto visuals, neon gradients, glassmorphism, and dense dashboards. Meet the
responsive and accessibility requirements in `docs/UI_UX_BRIEF.md`.

Work in small milestones. For each milestone:

1. Implement only one coherent UI capability.
2. Run `npm run typecheck`, `npm run build`, and relevant tests.
3. Show me `git diff --stat`, summarize visible changes, and name files changed.
4. Propose one Conventional Commit message.
5. Ask for my explicit approval before committing.
6. After approval, commit and push `frontend/ui`.
7. Append material AI assistance and human verification to `AI_USAGE.md`.

Preferred commit examples:

```text
feat(web): build public passport layout
feat(web): add repair history timeline
feat(web): add repairer workspace form
feat(web): show transaction status states
fix(web): improve mobile passport accessibility
docs: record frontend AI assistance
```

Never create one large commit. Never commit secrets, `.env`, recovery phrases,
private keys, `node_modules`, or build output. Do not merge into `main`; open a
pull request and let the other teammate review it.

Start by inspecting the existing scaffold and propose the smallest first UI
milestone. Do not rewrite the entire project in one pass.

---
