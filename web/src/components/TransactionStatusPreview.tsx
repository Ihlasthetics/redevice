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
import { transactionExplorerUrl } from "../constants";
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

type TransactionStatusPreviewProps = {
  status: TransactionStatus;
  digest?: string | null;
  error?: string | null;
};

function TransactionStatusPreview({
  status,
  digest,
  error,
}: TransactionStatusPreviewProps) {
  const activeState = transactionStatusAdapter.getById(status);
  const styles = toneStyles[activeState.tone];

  return (
    <div
      className={clsx("mt-6 rounded-2xl border p-4 sm:p-5", styles.shell)}
      aria-live="polite"
      role="status"
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
        <div className="min-w-0">
          <p
            className={clsx(
              "text-xs font-bold uppercase tracking-[0.14em]",
              styles.eyebrow,
            )}
          >
            Sui Testnet transaction
          </p>
          <h4 className="mt-1.5 text-lg font-semibold tracking-[-0.015em]">
            {activeState.label}
          </h4>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            {activeState.description}
          </p>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/60 p-3 text-xs leading-5 text-red-800">
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <p>{error}</p>
            </div>
          )}

          {digest ? (
            <a
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-success/20 bg-surface px-3.5 text-xs font-semibold text-success transition-colors hover:border-success"
              href={transactionExplorerUrl(digest)}
              target="_blank"
              rel="noreferrer"
            >
              <BadgeCheck aria-hidden="true" className="size-4" />
              View confirmed transaction
            </a>
          ) : (
            <div className="mt-3 flex items-start gap-2 border-t border-current/10 pt-3">
              <FileClock
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <p className="text-xs leading-5 text-ink/70">
                {activeState.nextStep}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TransactionStatusPreview;
