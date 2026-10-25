import { useEffect, useState, type FormEvent } from "react";
// Vite resolves this import to the passkey kit's Stellar SDK for XDR compatibility.
import { contract } from "@stellar/stellar-sdk";
import { IndexedDBStorage, SmartAccountKit } from "smart-account-kit";
import AppShell from "./components/AppShell";
import {
  CONTRACT_ID,
  FIVE_DIGIT_IDS,
  getAdministrator,
  getDevice,
  getRepairs,
  hasRole,
  NETWORK,
  RPC_URL,
  transactionExplorerUrl,
  type Status,
} from "./stellar/client";

// This page is included only in local development or an explicitly enabled Testnet build.
const kit = new SmartAccountKit({
  rpcUrl: RPC_URL,
  networkPassphrase: NETWORK,
  accountWasmHash:
    "1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a",
  webauthnVerifierAddress:
    "CC7EKIHQP3TN4CARQDND6CEOY2UXLWWC2X5GHTD5NLAT7BG5GPZIOM3F",
  relayerUrl: import.meta.env.DEV
    ? "http://localhost:8787"
    : `${window.location.origin}/api/passkey`,
  storage: new IndexedDBStorage(),
});

type AttestMethods = {
  attest_repair: (
    args: Record<string, unknown>,
    options?: contract.MethodOptions,
  ) => Promise<contract.AssembledTransaction<contract.Result<number>>>;
};

const message = (error: unknown) =>
  error instanceof Error ? error.message : "Passkey action failed.";

export default function PasskeySpike() {
  const [account, setAccount] = useState("");
  const [deviceId, setDeviceId] = useState(FIVE_DIGIT_IDS ? "" : "1");
  const [repairType, setRepairType] = useState("Screen replacement");
  const [notes, setNotes] = useState("Testnet passkey repair attestation");
  const [status, setStatus] = useState<Status>("Repaired");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [hash, setHash] = useState("");
  const [testToken, setTestToken] = useState("");
  const [testUnlocked, setTestUnlocked] = useState(import.meta.env.DEV);

  useEffect(() => {
    void kit.connectWallet().then(
      () => setAccount(kit.contractId ?? ""),
      () => setAccount(""),
    );
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function createAccount() {
    const created = await kit.createWallet("ReDevice Testnet", "repairer", {
      autoSubmit: true,
    });
    if (!created.submitResult)
      throw new Error("Account creation did not submit a transaction.");
    if (!created.submitResult.success)
      throw new Error(created.submitResult.error.message);
    setAccount(created.contractId);
    setHash(created.submitResult.hash);
    setNotice(
      `Account created: ${created.contractId}. Deployment transaction: ${created.submitResult.hash}. Ask the admin to grant this C-address the Repairer role before attesting.`,
    );
  }

  async function unlockTest() {
    const response = await fetch("/api/passkey/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: testToken }),
    });
    if (!response.ok) throw new Error("Test access was refused.");
    setTestToken("");
    setTestUnlocked(true);
    setNotice("Test access enabled for this browser session.");
  }

  async function connectAccount() {
    await kit.connectWallet({ prompt: true });
    if (!kit.contractId) throw new Error("No passkey account was found.");
    setAccount(kit.contractId);
    setNotice(`Connected ${kit.contractId}`);
  }

  async function attest(event: FormEvent) {
    event.preventDefault();
    if (!account || busy) return;
    await run(async () => {
      if (!(await hasRole("Repairer", account)))
        throw new Error(
          `Passkey account ${account} does not have Repairer access on this contract. Ask the administrator to grant this exact C-address at /admin, then retry.`,
        );
      const device = await getDevice(deviceId);
      if (!device) throw new Error(`Device ${deviceId} was not found.`);
      if (
        !window.confirm(
          `Approve this public Testnet repair?\nDevice: ${deviceId}\nType: ${repairType}\nNotes: ${notes}\nNew status: ${status}`,
        )
      )
        return;
      const key = `redevice:passkey-spike:${CONTRACT_ID}:${account}:${deviceId}:${repairType}:${notes}:${status}`;
      let requestId = localStorage.getItem(key);
      if (!requestId) {
        requestId = Array.from(
          crypto.getRandomValues(new Uint8Array(32)),
          (byte) => byte.toString(16).padStart(2, "0"),
        ).join("");
        localStorage.setItem(key, requestId);
      }
      const client = await contract.Client.from<AttestMethods>({
        contractId: CONTRACT_ID,
        rpcUrl: RPC_URL,
        networkPassphrase: NETWORK,
        publicKey: await getAdministrator(),
      });
      const tx = await client.attest_repair({
        repairer: account,
        request_id: Uint8Array.from(
          requestId.match(/../g)!.map((byte) => parseInt(byte, 16)),
        ),
        device_id: BigInt(deviceId),
        repair_type: repairType.trim(),
        notes: notes.trim(),
        next_status: { tag: status },
        battery_health: undefined,
        claimed_service_time: undefined,
      });
      if (tx.isReadCall) throw new Error("Expected a write transaction.");
      const result = await kit.signAndSubmit(tx as never);
      if (!result.success) throw new Error(result.error.message);
      setHash(result.hash);
      const refreshed = await getDevice(deviceId);
      const repairs = refreshed
        ? await getRepairs(deviceId, refreshed.repair_count)
        : [];
      const found = repairs.some(
        (repair) =>
          repair.repairer === account &&
          repair.repair_type === repairType.trim() &&
          repair.notes === notes.trim(),
      );
      if (!found)
        throw new Error(
          `Transaction ${result.hash} succeeded, but repair readback did not match. Do not retry yet.`,
        );
      localStorage.removeItem(key);
      setNotice(`Repair confirmed on Testnet: ${result.hash}`);
    });
  }

  return (
    <AppShell active="passkey">
      <div className="rd-content">
        <div>
          <h1 className="rd-page-title">Passkey repair</h1>
          <p className="rd-page-summary">
            Authorize a public service record with a passkey. Keep this page
            open until Testnet confirms it.
          </p>
        </div>
        {notice && (
          <p role="status" className="rd-panel break-all p-4 text-sm">
            {notice}
          </p>
        )}
        {hash && (
          <a
            className="text-sm font-semibold text-brand underline"
            href={transactionExplorerUrl(hash)}
            target="_blank"
            rel="noreferrer"
          >
            View Testnet transaction
          </a>
        )}
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
          <div className="grid gap-5">
            <section className="rd-panel p-6">
              <h2 className="rd-panel-heading">1. Connect your passkey</h2>
              <p className="mt-2 text-sm text-muted">
                The same browser and website address are needed to reconnect an
                existing account.
              </p>
              {!testUnlocked && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(unlockTest);
                  }}
                  className="mt-5 flex flex-wrap items-end gap-3"
                >
                  <label className="rd-field min-w-48 flex-1">
                    Test access token
                    <input
                      type="password"
                      autoComplete="off"
                      value={testToken}
                      onChange={(event) => setTestToken(event.target.value)}
                      className="border p-3"
                      placeholder="Enter test token"
                    />
                  </label>
                  <button
                    disabled={busy || !testToken}
                    className="min-h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Unlock test
                  </button>
                </form>
              )}
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-xs text-muted">Passkey account</p>
                <p className="mt-1 break-all font-mono text-sm font-semibold">
                  {account || "Not connected"}
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  disabled={busy || !testUnlocked}
                  onClick={() => void run(createAccount)}
                  className="min-h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Create passkey account
                </button>
                <button
                  disabled={busy}
                  onClick={() => void run(connectAccount)}
                  className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold disabled:opacity-50"
                >
                  Reconnect
                </button>
              </div>
            </section>
            <section className="rd-panel p-6">
              <h2 className="rd-panel-heading">2. Get Repairer access</h2>
              <p className="mt-2 text-sm text-muted">
                Share the exact C-address above with the administrator. They
                grant it Repairer access on this contract.
              </p>
              <a
                href="/admin"
                className="mt-4 inline-block text-sm font-semibold text-brand underline"
              >
                Open access control
              </a>
            </section>
          </div>
          <form
            onSubmit={(event) => void attest(event)}
            className="rd-panel grid gap-4 p-6"
          >
            <div>
              <h2 className="rd-panel-heading">3. Attest a repair</h2>
              <p className="mt-2 text-sm text-muted">
                Confirm the device and details. Repair notes will be public.
              </p>
            </div>
            <label className="rd-field">
              Device ID
              <input
                placeholder={
                  FIVE_DIGIT_IDS ? "Five digit device ID" : "Device ID"
                }
                inputMode="numeric"
                value={deviceId}
                onChange={(event) => setDeviceId(event.target.value)}
                className="border p-3"
              />
            </label>
            <label className="rd-field">
              Repair type
              <input
                value={repairType}
                onChange={(event) => setRepairType(event.target.value)}
                className="border p-3"
              />
            </label>
            <label className="rd-field">
              Public repair notes
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-28 border p-3"
              />
            </label>
            <label className="rd-field">
              New condition
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as Status)}
                className="border p-3"
              >
                <option>Repaired</option>
                <option>Refurbished</option>
                <option>PartsOnly</option>
              </select>
            </label>
            <button
              disabled={busy || !account || !testUnlocked}
              className="min-h-11 rounded-lg bg-ink px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Approve repair with passkey
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
