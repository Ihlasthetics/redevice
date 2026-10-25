import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Admin from "./Admin";

const mocks = vi.hoisted(() => ({
  connectWallet: vi.fn(),
  getConnectedWallet: vi.fn(),
  getAdministrator: vi.fn(),
  hasRole: vi.fn(),
  changeRepairerRole: vi.fn(),
}));

vi.mock("./stellar/client", () => ({
  CONTRACT_ID: "CTESTCONTRACT",
  requireContractId: () => "CTESTCONTRACT",
  connectWallet: mocks.connectWallet,
  getConnectedWallet: mocks.getConnectedWallet,
  getAdministrator: mocks.getAdministrator,
  hasRole: mocks.hasRole,
  changeRepairerRole: mocks.changeRepairerRole,
  transactionExplorerUrl: (hash: string) => `https://example.test/${hash}`,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdministrator.mockResolvedValue("GADMIN");
  mocks.getConnectedWallet.mockResolvedValue(null);
  mocks.hasRole.mockResolvedValue(false);
});

describe("administrator screen", () => {
  it("blocks the management screen for a non-admin wallet", async () => {
    mocks.connectWallet.mockResolvedValue("GOTHER");
    render(<Admin />);
    fireEvent.click(screen.getByRole("button", { name: /Connect Freighter/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/not the contract administrator/),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /Grant Repairer/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Revoke grant/i }),
    ).not.toBeInTheDocument();
  });

  it("restores the administrator wallet and grants a repairer", async () => {
    mocks.getConnectedWallet.mockResolvedValue("GADMIN");
    mocks.hasRole.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mocks.changeRepairerRole.mockResolvedValue({ hash: "a".repeat(64) });
    render(<Admin />);
    await waitFor(() =>
      expect(screen.getByText(/verified as administrator/)).toBeInTheDocument(),
    );
    expect(mocks.connectWallet).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Wallet address"), {
      target: { value: "GTARGET" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check access" }));
    await waitFor(() =>
      expect(screen.getByText("No Repairer access")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Grant Repairer/i }));
    await waitFor(() =>
      expect(screen.getByText("Repairer active")).toBeInTheDocument(),
    );
    expect(mocks.changeRepairerRole).toHaveBeenCalledWith(
      "GADMIN",
      "GTARGET",
      true,
    );
  });

  it("hides management controls when Freighter switches accounts", async () => {
    mocks.getConnectedWallet.mockResolvedValue("GADMIN");
    render(<Admin />);
    await waitFor(() =>
      expect(screen.getByText("Manage an account")).toBeInTheDocument(),
    );
    mocks.getConnectedWallet.mockResolvedValue("GOTHER");
    fireEvent.focus(window);
    await waitFor(() =>
      expect(screen.getByText("Admin access required")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Manage an account")).not.toBeInTheDocument();
  });
});
