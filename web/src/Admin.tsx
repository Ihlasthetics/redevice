import { useEffect, useState, type FormEvent } from "react";
import { ShieldCheck, UserRoundCheck, UserRoundX, Wallet } from "lucide-react";
import AppShell from "./components/AppShell";
import {
  changeRepairerRole,
  CONTRACT_ID,
  getAdministrator,
  hasRole,
  requireContractId,
  transactionExplorerUrl,
} from "./stellar/client";
import { useWallet } from "./stellar/useWallet";

const errorText = (cause: unknown) =>
  cause instanceof Error ? cause.message : "The operation failed.";

export default function Admin() {
  const [administrator, setAdministrator] = useState("");
  const { wallet, checking, connect: connectFreighter } = useWallet();
  const [account, setAccount] = useState("");
  const [checkedAccount, setCheckedAccount] = useState("");
  const [hasRepairerRole, setHasRepairerRole] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [transaction, setTransaction] = useState("");
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    try {
      requireContractId();
    } catch (cause) {
      setConfigured(false);
      setError(errorText(cause));
      return;
    }
    let active = true;
    void getAdministrator()
      .then((value) => {
        if (active) setAdministrator(value);
      })
      .catch((cause) => {
        if (active)
          setError(`Could not read administrator: ${errorText(cause)}`);
      });
    return () => {
      active = false;
    };
  }, []);

  async function connect() {
    setError("");
    setNotice("");
    try {
      await connectFreighter();
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  async function check(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const address = account.trim();
      const role = await hasRole("Repairer", address);
      setCheckedAccount(address);
      setHasRepairerRole(role);
    } catch (cause) {
      setCheckedAccount("");
      setHasRepairerRole(null);
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(grant: boolean) {
    if (!wallet || wallet !== administrator || busy) return;
    setBusy(true);
    setError("");
    setNotice("Approve the authorization and transaction in Freighter.");
    setTransaction("");
    try {
      const address = account.trim();
      const result = await changeRepairerRole(wallet, address, grant);
      setTransaction(result.hash);
      const role = await hasRole("Repairer", address);
      setCheckedAccount(address);
      setHasRepairerRole(role);
      if (role !== grant)
        throw new Error(
          "The transaction succeeded, but the role check did not match. Review it in the explorer.",
        );
      setNotice(
        grant
          ? `Repairer access granted to ${address}.`
          : `Repairer access revoked from ${address}.`,
      );
    } catch (cause) {
      setNotice("");
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  const isAdmin = Boolean(wallet && administrator && wallet === administrator);
  const checked = checkedAccount === account.trim();

  return (
    <AppShell active="admin">
      <div className="rd-content">
        {!isAdmin ? (
          <section className="rd-panel grid items-start gap-8 p-7 sm:p-9 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
            <div>
              <ShieldCheck className="text-brand" size={28} />
              <h1 className="rd-page-title mt-5">Admin access required</h1>
              <p className="mt-3 max-w-xl text-muted" role="status">
                {checking || (!administrator && configured && !error)
                  ? "Checking your Freighter account…"
                  : wallet
                    ? "This wallet is not the contract administrator. Select the administrator account in Freighter to continue."
                    : "Connect the contract administrator account in Freighter to continue."}
              </p>
              {error && (
                <p role="alert" className="mt-4 text-sm text-amber-900">
                  {error}
                </p>
              )}
              <button
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 text-white disabled:opacity-50"
                disabled={!configured || busy}
                onClick={() => void connect()}
              >
                <Wallet size={18} /> Connect Freighter
              </button>
            </div>
            <div className="border-t border-line pt-6 text-sm lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <h2 className="rd-panel-heading">What admins manage</h2>
              <p className="mt-3 text-muted">
                Grant or revoke Repairer access for a public Testnet wallet or
                passkey account.
              </p>
              <p className="mt-4 text-muted">
                Only the contract administrator can approve a role change. Every
                change requires a Freighter signature.
              </p>
            </div>
          </section>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="rd-page-title">Repairer access</h1>
                <p className="mt-2 max-w-2xl text-muted">
                  Authorize real repairers to add service attestations to device
                  passports. Every change is recorded on Stellar Testnet.
                </p>
              </div>
              <button
                className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-white disabled:opacity-50"
                disabled={!configured || busy}
                onClick={() => void connect()}
              >
                <Wallet size={18} />
                {wallet
                  ? `${wallet.slice(0, 6)}…${wallet.slice(-4)} · reconnect`
                  : "Connect Freighter"}
              </button>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-amber-700/30 bg-amber-50 p-4 text-amber-900"
              >
                {error}
              </p>
            )}
            {notice && (
              <p
                role="status"
                className="rounded-xl border border-line bg-surface p-4 break-all"
              >
                {notice}
              </p>
            )}
            {transaction && (
              <a
                className="w-fit text-sm font-semibold text-brand underline"
                href={transactionExplorerUrl(transaction)}
                target="_blank"
                rel="noreferrer"
              >
                View transaction in Stellar Expert
              </a>
            )}

            <section className="order-3 grid items-start gap-4 sm:grid-cols-2">
              <div className="rd-panel p-5">
                <div className="flex items-center gap-2 text-brand">
                  <ShieldCheck size={20} />
                  <h2 className="font-semibold">Contract administrator</h2>
                </div>
                <p className="mt-3 break-all font-mono text-sm">
                  {administrator || "Loading…"}
                </p>
                <p className="mt-3 text-sm text-muted">
                  {isAdmin
                    ? "Connected wallet verified as administrator."
                    : wallet
                      ? "Connected wallet is not this contract's administrator."
                      : "Connect this wallet to manage access."}
                </p>
              </div>
              <div className="rd-panel p-5">
                <h2 className="font-semibold">Contract</h2>
                <p className="mt-3 break-all font-mono text-sm">
                  {CONTRACT_ID || "Not configured"}
                </p>
                <p className="mt-3 text-sm text-muted">
                  Only the contract administrator can grant or revoke Repairer
                  access.
                </p>
              </div>
            </section>

            <section className="rd-panel order-2 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="rd-panel-heading">Manage an account</h2>
                  <p className="mt-1 text-sm text-muted">
                    Enter the repairer's public Testnet address (G… wallet or C…
                    passkey account).
                  </p>
                </div>
                {checked && hasRepairerRole !== null && (
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${hasRepairerRole ? "bg-success-soft text-success" : "bg-canvas text-muted"}`}
                  >
                    {hasRepairerRole ? "Repairer active" : "No Repairer access"}
                  </span>
                )}
              </div>
              <form
                className="mt-5 flex flex-col gap-3 sm:flex-row"
                onSubmit={(event) => void check(event)}
              >
                <label className="sr-only" htmlFor="admin-account">
                  Wallet address
                </label>
                <input
                  id="admin-account"
                  className="min-w-0 flex-1 rounded-xl border border-line p-3 font-mono text-sm"
                  placeholder="G… or C… address"
                  value={account}
                  onChange={(event) => {
                    setAccount(event.target.value);
                    setCheckedAccount("");
                    setHasRepairerRole(null);
                  }}
                />
                <button
                  className="rounded-xl border border-line px-4 py-3 font-medium disabled:opacity-50"
                  disabled={busy || !account.trim()}
                >
                  Check access
                </button>
              </form>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="flex items-center gap-2 rounded-xl bg-ink px-4 py-3 font-medium text-white disabled:opacity-50"
                  disabled={
                    !isAdmin ||
                    busy ||
                    !account.trim() ||
                    (checked && hasRepairerRole === true)
                  }
                  onClick={() => void changeRole(true)}
                >
                  <UserRoundCheck size={18} /> Grant Repairer
                </button>
                <button
                  className="flex items-center gap-2 rounded-xl border border-line px-4 py-3 font-medium disabled:opacity-50"
                  disabled={
                    !isAdmin ||
                    busy ||
                    !account.trim() ||
                    (checked && hasRepairerRole === false)
                  }
                  onClick={() => void changeRole(false)}
                >
                  <UserRoundX size={18} /> Revoke grant
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
