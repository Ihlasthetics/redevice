# Contributing

Use a feature branch and open a PR for review before merging. Keep contract and browser changes in `stellar/` and `web/src/stellar/`. The active browser must read and write only Stellar Testnet records.

Run the frontend and contract checks in [README](README.md) before review. Validate behavior with a real deployed Testnet contract before claiming wallet, QR, or transaction success. Never commit wallet secrets or put them in `VITE_` variables.
