# Test the passkey flow from Yhlas's computer

This is a **Stellar Testnet feasibility test**, not the finished passkey feature. Use a Vercel **Preview** deployment of the existing `yhlas/redevice` project, assigned to the single public address [redevice-six.vercel.app](https://redevice-six.vercel.app). Its `/passkey-spike` page lets one repairer create a passkey account and attest one repair with a sponsor-paid transaction. The public buyer and Freighter paths remain available.

## 1. Pull and verify this branch

On Yhlas's computer, from the repository directory:

```sh
git fetch origin
git switch feature/passkey-vercel-preview
git pull --ff-only origin feature/passkey-vercel-preview
npm ci
npm run format:check
npm run typecheck
npm test
node --test scripts/passkey-spike-policy.test.mjs scripts/passkey-vercel.test.mjs
npm run build
```

Use Node.js 22.12 or later. The code includes a temporary Preview function in `api/`. Do not put any key or token in a tracked file or `VITE_*` variable.

## 2. Link the existing Vercel project

```sh
vercel login
vercel whoami
vercel link
vercel project inspect redevice
vercel env ls
```

During `vercel link`, choose the account/scope and **existing** `redevice` project that owns `redevice-six.vercel.app`. If the CLI offers to create a project, cancel and correct the account or scope. The current public site uses contract `CBR76DY4ZIRCB2CK5A2V7CC4I4UF7SQ5ULUHT6HMP4ZWN3R32BWAOIQP` and administrator `GBYKDBAWYNIVU24MVH2ENOYFLSU7LXRNHFWJ7WOPF3Q76C3MDV5SWCLD`.

## 3. Set Preview environment variables

In **Project Settings → Environment Variables**, select **Preview** for every variable below. Reuse existing values where present. These are set before deployment, so no redeploy is needed between account creation and repair.

| Name                           | Value                                                             |
| ------------------------------ | ----------------------------------------------------------------- |
| `VITE_STELLAR_CONTRACT_ID`     | `CBR76DY4ZIRCB2CK5A2V7CC4I4UF7SQ5ULUHT6HMP4ZWN3R32BWAOIQP`        |
| `VITE_FIVE_DIGIT_IDS`         | `true`                                                            |
| `VITE_PASSKEY_TESTING`         | `true`                                                            |
| `PASSKEY_REDEVICE_CONTRACT_ID` | The same `CBR76...` contract ID                                   |
| `PASSKEY_TEST_ENABLED`         | `true`                                                            |
| `PASSKEY_ALLOW_CREATE`         | `true`                                                            |
| `PASSKEY_TEST_TOKEN`           | A fresh random string of at least 32 characters; mark as secret   |
| `CHANNELS_API_KEY`             | A dedicated **Testnet** OpenZeppelin Channels key; mark as secret |

Generate the test token locally with `openssl rand -hex 24`, and give it only to the tester through a private channel. Generate the Channels key at [OpenZeppelin's Testnet endpoint](https://channels.openzeppelin.com/testnet/gen). Store the key only in Vercel Preview; never paste it into this repository, the browser, or a public message. The API function rejects calls outside Vercel Preview and verifies the exact signed Soroban operation. For repair, it also checks the passkey account's live `Repairer` role before asking Channels to pay.

The listed contract uses corrected WASM SHA-256 `583425b1943ce3656c5a0ada771911a7b4522151c799bc8cbc723b6fdd1a812e` and derives its five digit ID from the browser-generated random request ID. The earlier five-digit contract `CBT2G6GG5BYRV7DFCECIOVZXHAVH3UQWK2KSYUA7CXZY34H7TQ74N3OM` must not be used for registration: transaction `52ee226f9ffed287bf8cb9583f69a31e70eebf91fcbdaadec3f1f3edb501ee1a` failed because its PRNG selected a different device key at execution than at simulation. `VITE_*` values are public browser configuration, so only public values should use that prefix.

## 4. Deploy the preview

```sh
vercel deploy --logs
```

Assign the Preview deployment to [redevice-six.vercel.app](https://redevice-six.vercel.app) and use only that hostname throughout the test. Do not run `vercel deploy --prod`: the sponsor is enabled by the Preview environment variables. Vercel Authentication is disabled for the project while multi-browser testing is underway; the sponsor still requires the private test token. Browser passkeys are scoped to the hostname. Accounts created on the removed `redevice-passkey-preview.vercel.app` alias cannot reconnect here; create a new passkey account and grant its new C-address Repairer access.

## 5. Test one account and one repair

1. In the admin browser, open `/register` and register a Testnet device with a unique test serial and initial **Used** status. Save its new five-digit ID and registration transaction hash.
2. In the repairer browser, open `/passkey-spike`, enter `PASSKEY_TEST_TOKEN`, and click **Unlock test**. Expect “Test access enabled.”
3. Click **Create passkey account** once and complete the device passkey prompt. Expect a new `C...` address and a deployment transaction hash. Save both. The repairer does not need Freighter or XLM. Passkeys created on another hostname cannot reconnect here.
4. On the same public hostname, open `/admin`. Connect the administrator wallet `GBYK...SWCLD` in Freighter on **Test Net**. Enter the repairer's exact `C...` address shown on `/passkey-spike`, click **Check access**, then **Grant Repairer**. Approve Freighter's prompts. Expect “Repairer active.” If the connected account is not that administrator, the grant controls remain disabled.
5. Return to `/passkey-spike` on the passkey computer. The account should reconnect on the same browser and hostname. If needed, click **Reconnect** and complete the passkey prompt.
6. Enter the new five-digit device ID, review the public repair type and notes, keep **Repaired** as the next status for a **Used** device, then click **Approve repair with passkey**. Confirm the exact details and complete the passkey prompt. Expect a transaction hash and “Repair confirmed on Testnet” after the public repair readback. Check the passport for the new device ID and record the repair hash.

If a transaction hash appears but the readback fails, **do not retry** until that hash has been checked on Stellar Testnet. If account creation or signing fails, capture the exact on-screen error. A passkey made on localhost or the old Preview alias will not reconnect on `redevice-six.vercel.app`; create the disposable test account on the canonical hostname.

## After the test

When testing is finished, remove or disable the test sponsor deliberately before changing the public alias. Changing Preview environment variables only affects later deployments; it does not disable an already deployed URL. Keep the test token private. This feasibility sponsor uses a secret gate, signed-call allowlist, and on-chain role check, but it has no durable rate counter or project spend cap. The planned reusable service in `passkey_sponsored_actions.md` is separate work.
