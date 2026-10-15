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

export function isWalletCancellation(error: unknown) {
  return (
    error instanceof Error &&
    /rejected|denied|cancel(?:led|ed)?|user abort/i.test(error.message)
  );
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function runConfirmedWrite({
  execute,
  refresh,
}: {
  execute: () => Promise<SuiExecutionResult>;
  refresh: () => Promise<unknown> | unknown;
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

    try {
      await refresh();
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
) {
  await refresh();
}
