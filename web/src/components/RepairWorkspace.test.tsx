import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { passportAdapter } from "../data/passport-adapter";

const walletMocks = vi.hoisted(() => ({
  signAndExecuteTransaction: vi.fn(),
  address: `0x${"1".repeat(64)}`,
  refetchAuthorization: vi.fn(),
}));

vi.mock("@mysten/dapp-kit-react", () => ({
  useCurrentAccount: () => ({ address: walletMocks.address }),
  useDAppKit: () => ({
    signAndExecuteTransaction: walletMocks.signAndExecuteTransaction,
  }),
}));

vi.mock("@mysten/dapp-kit-react/ui", () => ({
  ConnectButton: () => <button type="button">Connect wallet</button>,
}));

vi.mock("../hooks/use-repairer-authorization", () => ({
  useRepairerAuthorization: () => ({
    data: true,
    error: null,
    refetch: walletMocks.refetchAuthorization,
  }),
}));

import RepairWorkspace from "./RepairWorkspace";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

const livePassport = {
  ...passportAdapter.getPublicPassport(),
  source: {
    kind: "live" as const,
    network: "Sui Testnet" as const,
    objectType: `0x${"a".repeat(64)}::redevice::DevicePassport`,
    fetchedAt: "2026-10-15T00:00:00.000Z",
  },
};

function submitRepair() {
  fireEvent.change(screen.getByLabelText(/repair notes/i), {
    target: { value: "Inspection completed" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /i reviewed/i }));
  fireEvent.click(
    screen.getByRole("button", { name: /sign and add repair record/i }),
  );
}

describe("repair actions", () => {
  beforeEach(() => {
    walletMocks.signAndExecuteTransaction.mockReset();
    walletMocks.address = `0x${"1".repeat(64)}`;
    walletMocks.refetchAuthorization.mockReset();
    walletMocks.refetchAuthorization.mockResolvedValue({
      data: true,
      error: null,
    });
  });

  it("does not expose a transaction action for an offline fixture", () => {
    render(
      <RepairWorkspace
        passport={passportAdapter.getPublicPassport()}
        onRepairConfirmed={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Transactions disabled for demo data"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sign and add repair record/i }),
    ).not.toBeInTheDocument();
  });

  it("does not sign when the final authorization check is revoked", async () => {
    walletMocks.refetchAuthorization.mockResolvedValue({
      data: false,
      error: null,
    });
    render(
      <RepairWorkspace passport={livePassport} onRepairConfirmed={vi.fn()} />,
    );

    submitRepair();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Repairer permission is no longer confirmed",
    );
    expect(walletMocks.signAndExecuteTransaction).not.toHaveBeenCalled();
  });

  it("shows a confirmed digest while passport refresh is still pending", async () => {
    const refresh = deferred<void>();
    walletMocks.signAndExecuteTransaction.mockResolvedValue({
      Transaction: { digest: "confirmed-digest" },
    });

    render(
      <RepairWorkspace
        passport={livePassport}
        onRepairConfirmed={() => refresh.promise}
      />,
    );

    submitRepair();

    expect(
      await screen.findByText("Transaction confirmed; refreshing passport"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /view confirmed transaction/i }),
    ).toHaveAttribute("href", expect.stringContaining("confirmed-digest"));
    expect(
      screen.queryByText("Approve in your wallet"),
    ).not.toBeInTheDocument();
  });

  it("retains the confirmed digest and offers read-only retry after refresh rejection", async () => {
    walletMocks.signAndExecuteTransaction.mockResolvedValue({
      Transaction: { digest: "confirmed-digest" },
    });

    render(
      <RepairWorkspace
        passport={livePassport}
        onRepairConfirmed={vi.fn().mockRejectedValue(new Error("RPC offline"))}
      />,
    );

    submitRepair();

    expect(
      await screen.findByText("Transaction confirmed; refresh unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /view confirmed transaction/i }),
    ).toHaveAttribute("href", expect.stringContaining("confirmed-digest"));
    expect(
      screen.getByRole("button", { name: /retry passport refresh/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /refresh passport before another repair/i,
      }),
    ).toBeDisabled();
    expect(
      screen.queryByText(/ledger execution failed/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/signature cancelled/i)).not.toBeInTheDocument();
  });

  it("retries only readback and never signs the confirmed write again", async () => {
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(new Error("RPC offline"))
      .mockResolvedValueOnce(undefined);
    walletMocks.signAndExecuteTransaction.mockResolvedValue({
      Transaction: { digest: "confirmed-digest" },
    });

    render(
      <RepairWorkspace passport={livePassport} onRepairConfirmed={refresh} />,
    );

    submitRepair();
    fireEvent.click(
      await screen.findByRole("button", { name: /retry passport refresh/i }),
    );

    expect(
      await screen.findByText("Repair record confirmed"),
    ).toBeInTheDocument();
    expect(walletMocks.signAndExecuteTransaction).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("link", { name: /view confirmed transaction/i }),
    ).toHaveAttribute("href", expect.stringContaining("confirmed-digest"));
  });

  it("resets the draft and keeps transaction proof with its original passport", async () => {
    walletMocks.signAndExecuteTransaction.mockResolvedValue({
      Transaction: { digest: "first-passport-digest" },
    });
    const firstPassport = { ...livePassport, id: `0x${"2".repeat(64)}` };
    const secondPassport = { ...livePassport, id: `0x${"3".repeat(64)}` };
    const props = { onRepairConfirmed: vi.fn().mockResolvedValue(undefined) };
    const view = render(
      <RepairWorkspace passport={firstPassport} {...props} />,
    );

    fireEvent.change(screen.getByLabelText(/repair notes/i), {
      target: { value: "First device only" },
    });
    submitRepair();
    expect(
      await screen.findByText("Repair record confirmed"),
    ).toBeInTheDocument();

    view.rerender(<RepairWorkspace passport={secondPassport} {...props} />);
    await waitFor(() => {
      expect(screen.getByLabelText(/repair notes/i)).not.toHaveValue(
        "First device only",
      );
    });
    expect(
      screen.queryByText("Repair record confirmed"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /view confirmed transaction/i }),
    ).not.toBeInTheDocument();

    view.rerender(<RepairWorkspace passport={firstPassport} {...props} />);
    expect(
      await screen.findByText("Repair record confirmed"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /view confirmed transaction/i }),
    ).toHaveAttribute("href", expect.stringContaining("first-passport-digest"));
  });

  it("freezes the submitted draft and does not refresh another wallet's passport after delayed signing", async () => {
    const signing = deferred<{ Transaction: { digest: string } }>();
    walletMocks.signAndExecuteTransaction.mockReturnValue(signing.promise);
    const refresh = vi.fn();
    const view = render(
      <RepairWorkspace passport={livePassport} onRepairConfirmed={refresh} />,
    );

    submitRepair();
    expect(screen.getByLabelText(/repair notes/i)).toBeDisabled();
    await waitFor(() =>
      expect(walletMocks.signAndExecuteTransaction).toHaveBeenCalledOnce(),
    );

    walletMocks.address = `0x${"2".repeat(64)}`;
    view.rerender(
      <RepairWorkspace passport={livePassport} onRepairConfirmed={refresh} />,
    );
    await act(async () => {
      signing.resolve({ Transaction: { digest: "original-wallet-digest" } });
      await signing.promise;
    });
    expect(refresh).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("link", { name: /view confirmed transaction/i }),
    ).not.toBeInTheDocument();

    walletMocks.address = `0x${"1".repeat(64)}`;
    view.rerender(
      <RepairWorkspace passport={livePassport} onRepairConfirmed={refresh} />,
    );
    expect(
      await screen.findByRole("link", { name: /view confirmed transaction/i }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("original-wallet-digest"),
    );
    expect(
      screen.getByText("Transaction confirmed; refresh unavailable"),
    ).toBeInTheDocument();
  });

  it("requires a fresh review after editing and keeps earlier proof after cancellation", async () => {
    walletMocks.signAndExecuteTransaction
      .mockResolvedValueOnce({ Transaction: { digest: "first-repair-digest" } })
      .mockRejectedValueOnce(new Error("User rejected request"));
    render(
      <RepairWorkspace
        passport={livePassport}
        onRepairConfirmed={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    submitRepair();
    expect(
      await screen.findByText("Repair record confirmed"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/repair notes/i), {
      target: { value: "Second inspection" },
    });
    expect(
      screen.getByRole("checkbox", { name: /i reviewed/i }),
    ).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: /i reviewed/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /submit another repair/i }),
    );

    expect(await screen.findByText("Signature cancelled")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /view earlier confirmed repair transaction/i,
      }),
    ).toHaveAttribute("href", expect.stringContaining("first-repair-digest"));
  });

  it("restores confirmed proof after switching away and back during readback", async () => {
    const refresh = deferred<void>();
    walletMocks.signAndExecuteTransaction.mockResolvedValue({
      Transaction: { digest: "readback-digest" },
    });
    const view = render(
      <RepairWorkspace
        passport={livePassport}
        onRepairConfirmed={() => refresh.promise}
      />,
    );
    submitRepair();
    await screen.findByText("Transaction confirmed; refreshing passport");

    walletMocks.address = `0x${"2".repeat(64)}`;
    view.rerender(
      <RepairWorkspace
        passport={livePassport}
        onRepairConfirmed={() => refresh.promise}
      />,
    );
    walletMocks.address = `0x${"1".repeat(64)}`;
    view.rerender(
      <RepairWorkspace
        passport={livePassport}
        onRepairConfirmed={() => refresh.promise}
      />,
    );
    await act(async () => {
      refresh.resolve();
      await refresh.promise;
    });

    expect(
      await screen.findByText("Transaction confirmed; refresh unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /view confirmed transaction/i }),
    ).toHaveAttribute("href", expect.stringContaining("readback-digest"));
  });
});
