export type SuiExecutionResult =
  | {
      Transaction: { digest: string };
      FailedTransaction?: never;
    }
  | {
      Transaction?: never;
      FailedTransaction: {
        digest?: string;
        status: { error?: { message?: string | null } | null };
      };
    };

export type ConfirmedWriteOutcome =
  | { status: "confirmed"; digest: string }
  | {
      status: "confirmed-refresh-failed";
      digest: string;
      error: string;
    }
  | { status: "cancelled"; digest: null; error: string }
  | { status: "failed"; digest: string | null; error: string }
  | { status: "unknown"; digest: null; error: string };

export const CONFIRMED_READBACK_TIMEOUT_MS = 10_000;

export function isWalletCancellation(error: unknown) {
  return (
    error instanceof Error &&
    /rejected|denied|cancel(?:led|ed)?|user abort/i.test(error.message)
  );
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function waitForRefresh(
  refresh: () => Promise<unknown> | unknown,
  timeoutMs: number,
  signal?: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("The passport refresh was interrupted."));
      return;
    }

    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
      callback();
    };
    const handleAbort = () =>
      finish(() => reject(new Error("The passport refresh was interrupted.")));
    const timeoutId = setTimeout(() => {
      finish(() =>
        reject(
          new Error(
            `The passport refresh timed out after ${Math.ceil(timeoutMs / 1_000)} seconds.`,
          ),
        ),
      );
    }, timeoutMs);

    signal?.addEventListener("abort", handleAbort, { once: true });
    Promise.resolve()
      .then(refresh)
      .then(
        () => finish(resolve),
        (error) => finish(() => reject(error)),
      );
  });
}

export async function runConfirmedWrite({
  execute,
  refresh,
  onConfirmed,
  refreshTimeoutMs = CONFIRMED_READBACK_TIMEOUT_MS,
  signal,
}: {
  execute: () => Promise<SuiExecutionResult>;
  refresh: () => Promise<unknown> | unknown;
  onConfirmed?: (digest: string) => void;
  refreshTimeoutMs?: number;
  signal?: AbortSignal;
}): Promise<ConfirmedWriteOutcome> {
  try {
    const result = await execute();

    if (result.FailedTransaction) {
      return {
        status: "failed",
        digest: result.FailedTransaction.digest ?? null,
        error:
          result.FailedTransaction.status.error?.message ??
          "Sui reported a failed transaction execution.",
      };
    }

    const digest = result.Transaction.digest;
    onConfirmed?.(digest);

    try {
      await waitForRefresh(refresh, refreshTimeoutMs, signal);
      return { status: "confirmed", digest };
    } catch (error) {
      return {
        status: "confirmed-refresh-failed",
        digest,
        error: messageFrom(
          error,
          "The transaction was confirmed, but the passport refresh failed.",
        ),
      };
    }
  } catch (error) {
    if (isWalletCancellation(error)) {
      return {
        status: "cancelled",
        digest: null,
        error: "The wallet signature was cancelled. No success is claimed.",
      };
    }

    return {
      status: "unknown",
      digest: null,
      error:
        "The wallet or network did not return a definitive result. Check wallet activity before submitting again.",
    };
  }
}

export function createSubmissionGuard() {
  let active = false;

  return {
    tryStart() {
      if (active) {
        return false;
      }

      active = true;
      return true;
    },
    finish() {
      active = false;
    },
  };
}

export async function retryConfirmedRefresh(
  refresh: () => Promise<unknown> | unknown,
  {
    timeoutMs = CONFIRMED_READBACK_TIMEOUT_MS,
    signal,
  }: { timeoutMs?: number; signal?: AbortSignal } = {},
) {
  await waitForRefresh(refresh, timeoutMs, signal);
}
