import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import {
  BatteryCharging,
  CircleDashed,
  FileUp,
  Info,
  Laptop,
  LockKeyhole,
  ShieldQuestion,
  WalletCards,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import {
  passportAdapter,
  repairWorkspaceAdapter,
} from "../data/passport-adapter";
import TransactionStatusPreview from "./TransactionStatusPreview";

function formatAddress(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function RepairWorkspace() {
  const passport = passportAdapter.getPublicPassport();
  const workspace = repairWorkspaceAdapter.getConfig();
  const currentAccount = useCurrentAccount();
  const walletAddress = currentAccount?.address ?? null;
  const authorization = repairWorkspaceAdapter.getAuthorization(walletAddress);
  const [repairType, setRepairType] = useState(workspace.defaultRepairType);
  const [nextCondition, setNextCondition] = useState(
    workspace.defaultNextCondition,
  );
  const [evidenceName, setEvidenceName] = useState<string | null>(null);

  return (
    <section
      id="repair-workspace"
      aria-labelledby="repair-workspace-title"
      className="border-t border-line py-12 sm:py-16"
    >
      <div className="flex flex-col gap-6 border-b border-line pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
              Authorized repairers
            </p>
            <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted">
              Integration pending
            </span>
          </div>
          <h2
            id="repair-workspace-title"
            className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl"
          >
            Add a repair record
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted sm:text-base sm:leading-7">
            Prepare a public service attestation for the selected device. The
            Move contract will decide whether the connected wallet may submit
            it.
          </p>
        </div>

        <div className="wallet-button min-h-11 self-start lg:self-end">
          <ConnectButton>
            <span className="inline-flex items-center gap-2">
              <WalletCards aria-hidden="true" className="size-4" />
              Connect repairer wallet
            </span>
          </ConnectButton>
        </div>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-5">
          <article className="rounded-[1.5rem] border border-line bg-surface p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-canvas text-brand">
                <WalletCards aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                  Connected identity
                </p>
                <p
                  className="mt-2 truncate font-mono text-sm font-semibold"
                  title={walletAddress ?? undefined}
                >
                  {walletAddress
                    ? formatAddress(walletAddress)
                    : "No wallet connected"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Sui testnet wallet
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-line pt-5">
              <div className="flex items-start gap-3">
                <ShieldQuestion
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-brand"
                />
                <div>
                  <p className="text-sm font-semibold">{authorization.label}</p>
                  <p className="mt-1.5 text-xs leading-5 text-muted">
                    {authorization.explanation}
                  </p>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-line bg-surface p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              Selected device
            </p>
            <div className="mt-4 flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-success-soft text-success">
                <Laptop aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">{passport.model}</h3>
                <p className="mt-1 font-mono text-xs text-muted">
                  {passport.id} · {passport.maskedSerial}
                </p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-canvas p-4 text-sm">
              <div>
                <dt className="text-xs text-muted">Current condition</dt>
                <dd className="mt-1 font-semibold">{passport.condition}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">New condition</dt>
                <dd className="mt-1 font-semibold">{nextCondition}</dd>
              </div>
            </dl>
          </article>
        </div>

        <form
          className="rounded-[1.5rem] border border-line bg-surface p-5 shadow-[0_28px_70px_-55px_rgba(21,31,28,0.5)] sm:p-7"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="flex items-start gap-3 border-b border-line pb-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success-soft text-success">
              <Wrench aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h3 className="text-xl font-semibold tracking-[-0.02em]">
                Service details
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted">
                You can prepare a draft now. Submission remains disabled until
                real contract authorization is connected.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Repair type
              <select
                className="mt-2 min-h-12 w-full rounded-xl border border-line bg-canvas px-3.5 text-sm font-medium text-ink"
                value={repairType}
                onChange={(event) => setRepairType(event.target.value)}
              >
                {workspace.repairTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold">
              Battery health
              <span className="ml-1 font-normal text-muted">(optional)</span>
              <span className="relative mt-2 block">
                <BatteryCharging
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
                />
                <input
                  className="min-h-12 w-full rounded-xl border border-line bg-canvas py-2 pl-10 pr-10 text-sm font-medium text-ink"
                  type="number"
                  min="0"
                  max="100"
                  inputMode="numeric"
                  placeholder="96"
                  aria-describedby="battery-health-hint"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
                  %
                </span>
              </span>
              <span
                id="battery-health-hint"
                className="mt-1.5 block text-xs font-normal leading-5 text-muted"
              >
                Enter the measured health after service.
              </span>
            </label>

            <label className="block text-sm font-semibold">
              Previous condition
              <input
                className="mt-2 min-h-12 w-full rounded-xl border border-line bg-line/25 px-3.5 text-sm font-medium text-muted"
                value={passport.condition}
                readOnly
              />
            </label>

            <label className="block text-sm font-semibold">
              New condition
              <select
                className="mt-2 min-h-12 w-full rounded-xl border border-line bg-canvas px-3.5 text-sm font-medium text-ink"
                value={nextCondition}
                onChange={(event) =>
                  setNextCondition(event.target.value as typeof nextCondition)
                }
              >
                {workspace.lifecycleConditions.map((condition) => (
                  <option key={condition}>{condition}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold sm:col-span-2">
              Repair notes
              <textarea
                className="mt-2 min-h-32 w-full resize-y rounded-xl border border-line bg-canvas px-3.5 py-3 text-sm font-normal leading-6 text-ink"
                placeholder="Describe the work completed and the checks performed."
                maxLength={500}
              />
              <span className="mt-1.5 block text-xs font-normal leading-5 text-muted">
                Public summary · maximum 500 characters
              </span>
            </label>
          </div>

          <fieldset className="mt-6 rounded-2xl border border-line p-4 sm:p-5">
            <legend className="px-2 text-sm font-semibold">
              Public evidence
            </legend>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {evidenceName ?? "No file selected"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Select a non-sensitive image or PDF for later Walrus upload.
                </p>
              </div>
              <label className="file-picker inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-canvas px-4 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand">
                <FileUp aria-hidden="true" className="size-4" />
                Choose file
                <input
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={(event) =>
                    setEvidenceName(event.target.files?.[0]?.name ?? null)
                  }
                />
              </label>
            </div>

            <div
              className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-3.5 text-amber-950"
              role="note"
            >
              <LockKeyhole
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-amber-800"
              />
              <p className="text-xs leading-5">{workspace.privacyWarning}</p>
            </div>
          </fieldset>

          <div className="mt-6 rounded-2xl border border-dashed border-line bg-canvas p-4">
            <div className="flex items-start gap-3">
              <Info
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-brand"
              />
              <p className="text-xs leading-5 text-muted">
                {workspace.integrationNotice}
              </p>
            </div>
          </div>

          <TransactionStatusPreview />

          <button
            className="mt-5 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-canvas opacity-55 sm:w-auto"
            type="submit"
            disabled
          >
            <CircleDashed aria-hidden="true" className="size-4" />
            Contract integration required
          </button>
        </form>
      </div>
    </section>
  );
}

export default RepairWorkspace;
