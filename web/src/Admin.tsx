import { useEffect, useState, type FormEvent } from "react";
import { ShieldCheck, UserRoundCheck, UserRoundX, Wallet } from "lucide-react";
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
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 p-5">
          <a href="/" className="text-2xl font-bold">
            ReDevice
          </a>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/" className="text-muted hover:text-ink">
              Passports
            </a>
            <span className="font-semibold text-brand">Admin</span>
          </nav>
          <span className="text-xs font-semibold uppercase tracking-widest text-brand">
            Stellar Testnet
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 p-5 py-8">
        {!isAdmin ? (
          <section className="mx-auto w-full max-w-xl rounded-2xl border border-line bg-surface p-8 text-center">
            <ShieldCheck className="mx-auto text-brand" size={36} />
            <h1 className="mt-4 text-2xl font-semibold">
              Admin access required
            </h1>
            <p className="mt-3 text-muted" role="status">
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
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-white disabled:opacity-50"
              disabled={!configured || busy}
              onClick={() => void connect()}
            >
              <Wallet size={18} /> Connect Freighter
            </button>
          </section>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand">
                  Administrator workspace
                </p>
                <h1 className="mt-2 text-4xl font-semibold">Repairer access</h1>
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

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-surface p-5">
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
              <div className="rounded-2xl border border-line bg-surface p-5">
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

            <section className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">Manage an account</h2>
                  <p className="mt-1 text-sm text-muted">
                    Enter the repairer's public Testnet wallet address.
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
                  placeholder="G… wallet address"
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
      </main>
    </div>
  );
}
