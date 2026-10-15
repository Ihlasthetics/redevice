import { describe, expect, it, vi } from "vitest";
import {
  createSubmissionGuard,
  retryConfirmedRefresh,
  runConfirmedWrite,
} from "./transaction-flow";

describe("confirmed write feedback", () => {
  it("does not make a success claim after signature cancellation", async () => {
    const outcome = await runConfirmedWrite({
      execute: vi.fn().mockRejectedValue(new Error("User rejected request")),
      refresh: vi.fn(),
    });

    expect(outcome.status).toBe("cancelled");
    expect(outcome.digest).toBeNull();
  });

  it("retains the hash when a confirmed write cannot be refreshed", async () => {
    const outcome = await runConfirmedWrite({
      execute: vi.fn().mockResolvedValue({
        Transaction: { digest: "known-digest" },
      }),
      refresh: vi.fn().mockRejectedValue(new Error("RPC offline")),
    });

    expect(outcome).toMatchObject({
      status: "confirmed-refresh-failed",
      digest: "known-digest",
    });
  });

  it("reports a confirmed ledger failure separately and keeps its hash", async () => {
    const outcome = await runConfirmedWrite({
      execute: vi.fn().mockResolvedValue({
        FailedTransaction: {
          digest: "failed-digest",
          status: { error: { message: "Move abort" } },
        },
      }),
      refresh: vi.fn(),
    });

    expect(outcome).toEqual({
      status: "failed",
      digest: "failed-digest",
      error: "Move abort",
    });
  });

  it("blocks rapid duplicate submissions until the first finishes", () => {
    const guard = createSubmissionGuard();

    expect(guard.tryStart()).toBe(true);
    expect(guard.tryStart()).toBe(false);
    guard.finish();
    expect(guard.tryStart()).toBe(true);
  });

  it("refresh retry calls only the readback callback", async () => {
    const write = vi.fn();
    const refresh = vi.fn().mockResolvedValue(undefined);

    await retryConfirmedRefresh(refresh);

    expect(refresh).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
  });
});
