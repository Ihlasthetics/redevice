# Contributing

Use a feature branch and open a PR for review before merging. Contract code lives in `stellar/`, the browser app in `web/`, and the sponsor endpoint in `api/`. The current demo reads and writes Stellar Testnet records.

Run the frontend and contract checks in [README](README.md) before review. Validate behavior with a real deployed Testnet contract before claiming wallet, QR, or transaction success. Never commit wallet secrets or put them in `VITE_` variables.
