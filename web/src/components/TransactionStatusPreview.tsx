import clsx from "clsx";
import {
  BadgeCheck,
  CircleAlert,
  CircleCheck,
  CloudUpload,
  FileClock,
  LoaderCircle,
  ShieldX,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import {
  transactionStatusAdapter,
  type TransactionStatus,
  type TransactionStatusDefinition,
} from "../data/passport-adapter";

const toneStyles: Record<
  TransactionStatusDefinition["tone"],
  { shell: string; icon: string; eyebrow: string }
> = {
  neutral: {
    shell: "border-line bg-canvas",
    icon: "bg-surface text-brand",
    eyebrow: "text-brand",
  },
  pending: {
    shell: "border-sky-800/20 bg-sky-50",
    icon: "bg-sky-100 text-sky-800",
    eyebrow: "text-sky-800",
  },
  success: {
    shell: "border-success/25 bg-success-soft/60",
    icon: "bg-success text-white",
    eyebrow: "text-success",
  },
  danger: {
    shell: "border-red-800/25 bg-red-50",
    icon: "bg-red-700 text-white",
    eyebrow: "text-red-800",
  },
};

function StatusIcon({ status }: { status: TransactionStatus }) {
  const iconClass = "size-5";

  switch (status) {
    case "ready":
      return <CircleCheck aria-hidden="true" className={iconClass} />;
    case "uploading":
      return <CloudUpload aria-hidden="true" className={iconClass} />;
    case "awaiting-signature":
      return <WalletCards aria-hidden="true" className={iconClass} />;
    case "submitting":
      return (
        <LoaderCircle
          aria-hidden="true"
          className={`${iconClass} animate-spin motion-reduce:animate-none`}
        />
      );
    case "confirmed":
      return <BadgeCheck aria-hidden="true" className={iconClass} />;
    case "rejected":
      return <ShieldX aria-hidden="true" className={iconClass} />;
  }
}

function TransactionStatusPreview() {
  const states = transactionStatusAdapter.getAll();
  const [activeStatus, setActiveStatus] = useState<TransactionStatus>("ready");
  const activeState = transactionStatusAdapter.getById(activeStatus);
  const styles = toneStyles[activeState.tone];

  return (
    <fieldset className="mt-6 rounded-2xl border border-line p-4 sm:p-5">
      <legend className="px-2 text-sm font-semibold">
        Transaction state preview
      </legend>

      <div className="flex items-start gap-3 rounded-xl bg-canvas p-3.5">
        <CircleAlert
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-brand"
        />
        <p className="text-xs leading-5 text-muted">
          These controls only review the six required interface states. Choosing
          one does not upload a file, request a signature, or run a blockchain
          transaction.
        </p>
      </div>

      <div
        className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"
        aria-label="Choose a transaction state to preview"
      >
        {states.map((state) => (
          <button
            key={state.id}
            className={clsx(
              "min-h-11 rounded-xl border px-3 text-xs font-semibold transition-colors",
              activeStatus === state.id
                ? "border-ink bg-ink text-canvas"
                : "border-line bg-surface text-muted hover:border-brand hover:text-brand",
            )}
            type="button"
            aria-pressed={activeStatus === state.id}
            onClick={() => setActiveStatus(state.id)}
          >
            {state.shortLabel}
          </button>
        ))}
      </div>

      <div
        className={clsx("mt-4 rounded-2xl border p-4 sm:p-5", styles.shell)}
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <span
            className={clsx(
              "grid size-10 shrink-0 place-items-center rounded-full",
              styles.icon,
            )}
          >
            <StatusIcon status={activeState.id} />
          </span>
          <div>
            <p
              className={clsx(
                "text-xs font-bold uppercase tracking-[0.14em]",
                styles.eyebrow,
              )}
            >
              {activeState.id === "rejected"
                ? "Move contract rejection"
                : "Transaction status"}
            </p>
            <h4 className="mt-1.5 text-lg font-semibold tracking-[-0.015em]">
              {activeState.label}
            </h4>
            <p className="mt-2 text-sm leading-6 text-ink/75">
              {activeState.description}
            </p>
            <div className="mt-3 flex items-start gap-2 border-t border-current/10 pt-3">
              <FileClock
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <p className="text-xs leading-5 text-ink/70">
                {activeState.nextStep}
              </p>
            </div>
          </div>
        </div>
      </div>
    </fieldset>
  );
}

export default TransactionStatusPreview;
