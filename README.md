# ReDevice

**Approve a Stellar action with a passkey, while the app pays the network fee.** ReDevice demonstrates this with a repair record for a refurbished device. The person sees the exact repair details, approves with their device passkey, and the resulting authorization and record can be checked on Stellar Testnet.

Many people reach a simple action in a Stellar app before they have a wallet, recovery phrase, or XLM for fees. Our passkey flow removes those steps for the repairer. A restricted relayer submits the transaction and pays its fee; it cannot approve the repair. The ReDevice smart contract also requires the repairer's authorization and an active **Repairer** role.

ReDevice is the **first demonstration**, not yet a reusable package. The current sponsor allows only approved Testnet smart-account creation and ReDevice repair calls. Delivery handoffs and other app actions are possible future integrations, not features of this repository today.

## See the demo

- **App:** [redevice-six.vercel.app](https://redevice-six.vercel.app)
- **Network:** Stellar Testnet
- **ReDevice contract:** `CBR76DY4ZIRCB2CK5A2V7CC4I4UF7SQ5ULUHT6HMP4ZWN3R32BWAOIQP`
- **Contract administrator:** `GBYKDBAWYNIVU24MVH2ENOYFLSU7LXRNHFWJ7WOPF3Q76C3MDV5SWCLD`

| Page                                                            | What it does                                            | What you need                                                |
| --------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| [Passports](https://redevice-six.vercel.app/)                   | Look up a device and read its public repair history     | A device ID; no wallet                                       |
| [Register device](https://redevice-six.vercel.app/register)     | Create a device passport                                | A funded Freighter wallet on Testnet                         |
| [Passkey repair](https://redevice-six.vercel.app/passkey-spike) | Create/reconnect a passkey account and approve a repair | Test access, an admin-granted Repairer role, and a device ID |
| [Repair workspace](https://redevice-six.vercel.app/repairer)    | Add a repair with Freighter                             | A funded Testnet wallet with the Repairer role               |
| [Access control](https://redevice-six.vercel.app/admin)         | Check, grant, or revoke Repairer access                 | The contract administrator's Freighter wallet                |

### Try a passkey repair yourself

The hosted passkey flow is a **gated Testnet demo**. A visitor cannot grant themselves Repairer access. Ask the ReDevice team for a test access token, an existing device ID if you do not want to register a device, and a grant for your new public passkey account address.

1. Open [Passkey repair](https://redevice-six.vercel.app/passkey-spike) on a device with Face ID, Touch ID, or a device PIN. Enter the team's test access token and select **Unlock test**.
2. Select **Create passkey account** and complete the device prompt. Copy the new public `C...` address. Keep using the same website and a browser where that passkey is available.
3. Send **only that public `C...` address** to the team. The contract administrator must grant it the **Repairer** role before a repair will work. Wait for the grant to be confirmed on Testnet.
4. Enter the device ID, review the public repair type, notes, and next condition, then select **Approve repair with passkey**. Confirm the details and complete the passkey prompt. The page shows a transaction link and checks the repair record after confirmation.
5. Open the device's public passport to see the new record without connecting a wallet.

The repairer does **not** need Freighter or XLM for this passkey flow. The relayer pays the Testnet fee from the app's funds. Device registration and admin role changes still use a funded Freighter wallet. If you want to register your own device first, go to [Register device](https://redevice-six.vercel.app/register), connect Freighter on **Test Net**, and save the resulting five-digit device ID.

**For the administrator:** Open [Access control](https://redevice-six.vercel.app/admin), connect the contract administrator account in Freighter on **Test Net**, enter the tester's exact public `C...` address, select **Check access**, then **Grant Repairer**. Approve the authorization and transaction prompts and wait for the role check to show active access. The same screen can grant a `G...` Freighter account for the wallet-based repair flow. Only the administrator account can grant or revoke this role.

Passports and repair notes are public Testnet data. Use test details; do not enter personal information or share a recovery phrase or private key. A repair record proves who submitted the attestation and when, not that the physical repair happened.

## How it works

1. The browser prepares a specific `attest_repair` call and shows the device and repair details before approval.
2. The repairer's passkey smart account authorizes that call. The signed authorization binds to the operation and its arguments.
3. The server checks the signed call against its narrow sponsor policy and the account's current Repairer role. OpenZeppelin Channels submits it and pays the Stellar fee.
4. The [Soroban contract](stellar/contracts/redevice/src/lib.rs) calls `require_auth` for the repairer, checks the Repairer role, and stores the public record. The app waits for confirmation and reads the repair back.

The relayer can choose whether to pay for a request, but it cannot create the repairer's passkey authorization. An admin can revoke Repairer access on-chain. The [passkey UI](web/src/PasskeySpike.tsx), [sponsor endpoint](api/passkey.mjs), and [sponsor policy](api/_passkey-policy.mjs) show the current integration.

## Run locally

Requires Node.js 22.12 or newer and npm. Freighter is needed for registration, wallet-based repair, and admin actions.

```sh
npm ci
cp web/.env.example web/.env.local
```

Set the public Testnet configuration in `web/.env.local`:

```dotenv
VITE_STELLAR_CONTRACT_ID=CBR76DY4ZIRCB2CK5A2V7CC4I4UF7SQ5ULUHT6HMP4ZWN3R32BWAOIQP
VITE_FIVE_DIGIT_IDS=true
```

```sh
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`. Public passports and Freighter flows use the configured Testnet contract. The local passkey page also needs a separately configured sponsor at `http://localhost:8787`; running Vite alone does not fund passkey transactions. See [the local sponsor script](scripts/passkey-spike-sponsor.mjs) for its required server-only settings. Never put a sponsor key or test token in a `VITE_` variable or commit it to the repository.

## Verify the code

```sh
npm run format:check
npm run typecheck
npm test
node --test scripts/passkey-spike-policy.test.mjs scripts/passkey-vercel.test.mjs
npm run build
cargo test --manifest-path stellar/Cargo.toml --locked
```

The browser app is in [`web/`](web/), the Soroban contract is in [`stellar/contracts/redevice/`](stellar/contracts/redevice/), and the restricted sponsor is in [`api/`](api/). This is a Testnet feasibility integration. A general-purpose package, durable sponsor spend limits, and a second-app reuse proof remain future work.
