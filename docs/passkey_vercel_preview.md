# Test the passkey flow from Yhlas's computer

This is a **Stellar Testnet feasibility test**, not the finished passkey feature. Use a Vercel **Preview** deployment of the existing `yhlas/redevice` project. Keep its production site unchanged. The preview's `/passkey-spike` page lets one repairer create a passkey account and attest one repair with a sponsor-paid transaction. The public buyer and Freighter paths remain available.

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

During `vercel link`, choose the account/scope and **existing** `redevice` project that owns `redevice-six.vercel.app`. If the CLI offers to create a project, cancel and correct the account or scope. The current production build uses contract `CCHXDDGMOZNABGIYGBOIWCFHD3RECIKI2UWJKMOGRBCSSIL6YACCX6WJ` and administrator `GBYKDBAWYNIVU24MVH2ENOYFLSU7LXRNHFWJ7WOPF3Q76C3MDV5SWCLD`.

## 3. Set Preview environment variables

In **Project Settings → Environment Variables**, select **Preview** for every variable below. Reuse existing values where present. These are set before deployment, so no redeploy is needed between account creation and repair.

| Name                           | Value                                                             |
| ------------------------------ | ----------------------------------------------------------------- |
| `VITE_STELLAR_CONTRACT_ID`     | `CCHXDDGMOZNABGIYGBOIWCFHD3RECIKI2UWJKMOGRBCSSIL6YACCX6WJ`        |
| `VITE_PASSKEY_TESTING`         | `true`                                                            |
| `PASSKEY_REDEVICE_CONTRACT_ID` | The same `CCHX...` contract ID                                    |
| `PASSKEY_TEST_ENABLED`         | `true`                                                            |
| `PASSKEY_ALLOW_CREATE`         | `true`                                                            |
| `PASSKEY_TEST_TOKEN`           | A fresh random string of at least 32 characters; mark as secret   |
| `CHANNELS_API_KEY`             | A dedicated **Testnet** OpenZeppelin Channels key; mark as secret |

Generate the test token locally with `openssl rand -hex 24`, and give it only to the tester through a private channel. Generate the Channels key at [OpenZeppelin's Testnet endpoint](https://channels.openzeppelin.com/testnet/gen). Store the key only in Vercel Preview; never paste it into this repository, the browser, or a public message. The API function rejects calls outside Vercel Preview and verifies the exact signed Soroban operation. For repair, it also checks the passkey account's live `Repairer` role before asking Channels to pay.

The current sequential-ID contract uses device `1`; leave `VITE_FIVE_DIGIT_IDS` unset. `VITE_*` values are public browser configuration, so only the two public values above should use that prefix.

## 4. Deploy the preview

```sh
vercel deploy --logs
```

Use the returned **Preview URL** throughout the test. Do not run `vercel deploy --prod`. Open `<preview-url>/passkey-spike` on the other computer. If Vercel deployment protection blocks that browser, grant the tester access to this preview in the Vercel dashboard before continuing. Keep the exact same preview hostname for passkey creation and reconnection; browser passkeys are scoped to that hostname.

## 5. Test one account and one repair

1. At `/passkey-spike`, enter `PASSKEY_TEST_TOKEN` and click **Unlock test**. Expect “Test access enabled.”
2. Click **Create passkey account** once and complete the device passkey prompt. Expect a new `C...` address and a deployment transaction hash. Save both. The repairer does not need Freighter or XLM.
3. On the **same preview URL**, open `/admin`. Connect the administrator wallet `GBYK...SWCLD` in Freighter on **Test Net**. Enter the new `C...` address, click **Check access**, then **Grant Repairer**. Approve Freighter's prompts. Expect “Repairer active.” If the connected account is not that administrator, the grant controls remain disabled.
4. Return to `/passkey-spike` on the passkey computer. The account should reconnect on the same browser and URL. If needed, click **Reconnect** and complete the passkey prompt.
5. Keep device ID `1`, review the public repair type, notes, and next status, then click **Approve repair with passkey**. Confirm the exact details and complete the passkey prompt. Expect a transaction hash and “Repair confirmed on Testnet” after the public repair readback. Check the passport for device `1` and record the repair hash.

If a transaction hash appears but the readback fails, **do not retry** until that hash has been checked on Stellar Testnet. If account creation or signing fails, capture the exact on-screen error. A passkey made on localhost will not reconnect on this preview hostname; create the disposable test account on the preview itself.

## After the test

Delete this exact preview deployment in the Vercel dashboard when testing is finished. Changing Preview environment variables only affects later deployments; it does not disable an already deployed URL. Keep the test token private. This feasibility sponsor uses a secret gate, signed-call allowlist, and on-chain role check, but it has no durable rate counter or project spend cap. The planned reusable service in `passkey_sponsored_actions.md` is separate work.
