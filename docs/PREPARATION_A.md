# Akif preparation: local and live checks

This work keeps the existing Sui Testnet implementation and does not add
Stellar, deploy contracts, grant roles, or sign transactions automatically.

## Reproduce locally

1. Use Node.js 22.22.2 and run `npm ci` at the repository root.
2. Run `npm run dev` and open `http://localhost:5173`.
3. Select the labeled demo fixture for a wallet-free UI walkthrough. Fixture
   records are not live and cannot be used for writes.
4. Run `npm test`, `npm run typecheck`, `npm run build`, and
   `npm run format:check` at the root. The tests mock RPC and wallet boundaries.

## Read-only live configuration check

Copy `web/.env.example` to an untracked `web/.env.local` and supply a mutually
compatible package, passport, registry, active RegistrarCap, and active
RepairerCap. A package ID alone does not establish compatibility. The checked-in
default passport is from a different package and the default registrar ID
duplicates the AdminCap ID, so default live registration is intentionally
blocked. Confirm object types and ownership through public Testnet reads; do
not use a private key or recovery phrase to diagnose this. All `VITE_` values
are public in the browser bundle.

Set `VITE_PUBLIC_APP_ORIGIN` only to an HTTPS origin reachable by the phone
used for QR testing. Localhost links work only on the same machine and are
warned about in the app.

## Human wallet walkthrough

With a known-compatible deployment and test wallets, separately verify:

- authorized and unauthorized registrar/repairer views, focus refresh, manual
  retry after RPC failure, and role revocation before submit;
- invalid serial/repair fields, review confirmations, and rapid duplicate
  clicks before wallet approval;
- wallet or device switch during pending signing, cancellation, confirmed
  failure, timeout, and retry of readback without a second write;
- transaction digest, created passport type, public notes, claimed service
  date, and optional ledger attestation date in a wallet-free passport read.

These are manual checks, not claimed results. Do not perform an actual write
without a separate, explicit team decision.
