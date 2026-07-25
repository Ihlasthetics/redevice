# Contributing

## Branch ownership

- Contract work: `contract/move`
- Frontend work: `frontend/ui`
- Stable, reviewed work: `main`

Do not work directly on the same branch. The contract owner should avoid
editing `web/`; the frontend owner should avoid editing `move/`. Coordinate
before changing root configuration files.

## Starting work

```bash
git switch main
git pull --ff-only
git switch -c frontend/ui
```

Use `contract/move` instead when starting contract work.

## Commit format

Use small commits that do one understandable thing:

```text
feat(web): build public passport layout
feat(web): add repair history timeline
feat(move): add device passport object
test(move): reject unauthorized repair updates
docs: record AI-assisted implementation
fix(web): improve mobile passport spacing
```

Allowed prefixes:

- `feat`: user-facing capability
- `fix`: bug fix
- `test`: test-only change
- `docs`: documentation
- `chore`: tooling or repository maintenance
- `refactor`: internal restructuring without new behavior

Before every commit:

```bash
git status
git diff
npm run typecheck
npm run build
```

Move changes must also run:

```bash
cd move/redevice
sui move test
```

Never commit secrets, recovery phrases, private keys, `.env` files, build
outputs, or `node_modules`.

## Pull requests

Push your own branch and open a pull request into `main`. The other teammate
reviews it before merge. Avoid squash-merging during the hackathon so the small,
chronological commit history stays visible.

Every pull request should explain:

- what changed
- what the user can now do
- which tests were run
- where AI assistance was used
- screenshots for visible UI changes
