import { useState } from "react";
import AppShell from "./components/AppShell";
import {
  deployInstance,
  formatXlm,
  grantOwnRole,
  previewUpload,
  submitUpload,
  verifyUploadedWasm,
  type UploadPreview,
} from "./stellar/deploy";
import { useWallet } from "./stellar/useWallet";

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Operation failed.";

export default function Deploy() {
  const { wallet, connect } = useWallet();
  const account = wallet ?? "";
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [wasmHash, setWasmHash] = useState("");
  const [contractId, setContractId] = useState("");
  const [repairerGranted, setRepairerGranted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [hash, setHash] = useState("");

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  const submitted = (value: string) => {
    setHash(value);
    setNotice("Submitted. Waiting for final confirmation…");
  };

  return (
    <AppShell active="deploy">
      <div className="rd-content max-w-4xl">
        <h1 className="rd-page-title">Testnet contract setup</h1>
        <p>
          Use your Freighter Testnet account. The corrected five digit ID WASM
          must be uploaded before deploying a new instance. Select the newly
          built WASM below and review the upload fee. New instances start
          without device records or Repairer grants.
        </p>
        <p>
          <a
            className="underline"
            href="/contract/redevice_stellar.wasm"
            download
          >
            Download the corrected WASM
          </a>{" "}
          (SHA-256:
          583425b1943ce3656c5a0ada771911a7b4522151c799bc8cbc723b6fdd1a812e).
        </p>

        <section className="rd-panel space-y-3 p-6">
          <h2 className="text-xl font-semibold">
            1. Connect and check the upload fee
          </h2>
          <button
            disabled={busy}
            className="rounded-xl bg-ink px-4 py-2 text-white disabled:opacity-50"
            onClick={() =>
              void run(async () => {
                const address = await connect();
                setPreview(null);
                setNotice(`Connected ${address}`);
              })
            }
          >
            Connect Freighter
          </button>
          {account && <p className="break-all text-sm">{account}</p>}
          <label className="block text-sm">
            Select{" "}
            <code>
              stellar/target/wasm32v1-none/release/redevice_stellar.wasm
            </code>
            <input
              className="mt-2 block w-full"
              type="file"
              accept=".wasm,application/wasm"
              disabled={busy}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
              }}
            />
          </label>
          <button
            disabled={busy || !account || !file}
            className="rounded-xl border border-line px-4 py-2 disabled:opacity-50"
            onClick={() =>
              void run(async () => {
                const next = await previewUpload(
                  new Uint8Array(await file!.arrayBuffer()),
                  account,
                );
                setPreview(next);
                setNotice(
                  "Upload simulation ready. Review the fee before signing.",
                );
              })
            }
          >
            Simulate upload
          </button>
          {preview && (
            <p className="font-semibold">
              Maximum fee bid: {formatXlm(preview.fee)} Testnet XLM
            </p>
          )}
        </section>

        <section className="rd-panel space-y-3 p-6">
          <h2 className="text-xl font-semibold">2. Upload the reviewed WASM</h2>
          <p className="text-sm">
            Freighter will ask you to sign the inner upload, then its fee bump.
            Review both prompts. If a prompt fails, simulate again.
          </p>
          <button
            disabled={busy || !preview || !!wasmHash}
            className="rounded-xl bg-ink px-4 py-2 text-white disabled:opacity-50"
            onClick={() =>
              void run(async () => {
                const result = await submitUpload(preview!, submitted);
                setWasmHash(result.wasmHash);
                setNotice("WASM upload confirmed and read back from Testnet.");
              })
            }
          >
            Sign and upload
          </button>
          <button
            disabled={busy || !account || !!wasmHash}
            className="ml-3 rounded-xl border border-line px-4 py-2 disabled:opacity-50"
            onClick={() =>
              void run(async () => {
                const verifiedHash = await verifyUploadedWasm();
                setWasmHash(verifiedHash);
                setNotice(
                  "Reviewed WASM is already on Testnet. Continue to deployment.",
                );
              })
            }
          >
            Check existing upload
          </button>
          {wasmHash && (
            <p className="break-all text-sm">WASM hash: {wasmHash}</p>
          )}
        </section>

        <section className="rd-panel space-y-3 p-6">
          <h2 className="text-xl font-semibold">
            3. Deploy a contract instance
          </h2>
          <p className="text-sm">
            Your connected account becomes the administrator.
          </p>
          <button
            disabled={busy || !wasmHash || !!contractId}
            className="rounded-xl bg-ink px-4 py-2 text-white disabled:opacity-50"
            onClick={() =>
              void run(async () => {
                const result = await deployInstance(
                  account,
                  wasmHash,
                  submitted,
                );
                setContractId(result.contractId);
                setNotice("Contract deployment confirmed.");
              })
            }
          >
            Deploy instance
          </button>
          {contractId && (
            <p className="break-all text-sm">Contract ID: {contractId}</p>
          )}
        </section>

        <section className="rd-panel space-y-3 p-6">
          <h2 className="text-xl font-semibold">4. Authorize a repairer</h2>
          <p className="text-sm">
            Any connected wallet can register a device. Only grant the Repairer
            role to an account you trust to attest real repairs.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={busy || !contractId || repairerGranted}
              className="rounded-xl border border-line px-4 py-2 disabled:opacity-50"
              onClick={() =>
                void run(async () => {
                  await grantOwnRole(
                    account,
                    contractId,
                    "Repairer",
                    submitted,
                  );
                  setRepairerGranted(true);
                  setNotice("Repairer role granted.");
                })
              }
            >
              Grant Repairer
            </button>
          </div>
          {contractId && (
            <p className="text-sm">
              Set <code>VITE_STELLAR_CONTRACT_ID={contractId}</code> in{" "}
              <code>web/.env.local</code>, restart the app, then open{" "}
              <a href="/" className="underline">
                ReDevice
              </a>
              .
            </p>
          )}
        </section>

        {notice && (
          <p role="status" className="rounded-xl border border-line p-3">
            {notice}
          </p>
        )}
        {hash && (
          <p className="break-all text-sm">
            Transaction:{" "}
            <a
              className="underline"
              href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
              target="_blank"
              rel="noreferrer"
            >
              {hash}
            </a>
          </p>
        )}
      </div>
    </AppShell>
  );
}
