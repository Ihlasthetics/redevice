import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const mocks = vi.hoisted(() => ({
  wallet: null as string | null,
  hasRole: vi.fn(),
  getAdministrator: vi.fn(),
  connect: vi.fn(),
}));

vi.mock("./stellar/useWallet", () => ({
  useWallet: () => ({ wallet: mocks.wallet, connect: mocks.connect }),
}));

vi.mock("./stellar/client", () => ({
  CONTRACT_ID: "CTESTCONTRACT",
  FIVE_DIGIT_IDS: false,
  requireContractId: () => "CTESTCONTRACT",
  hasRole: mocks.hasRole,
  getAdministrator: mocks.getAdministrator,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.wallet = null;
  mocks.getAdministrator.mockResolvedValue("GADMIN");
  mocks.hasRole.mockResolvedValue(false);
  window.history.replaceState({}, "", "/");
});

describe("registrar and repairer screens", () => {
  it("shows only passport lookup and registration to a registrar", () => {
    window.history.replaceState({}, "", "/register");
    render(<App view="register" />);
    expect(
      screen.getByRole("heading", { name: "Find a passport" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Register a device" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Attest a repair" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Invalid Stellar passport link/),
    ).not.toBeInTheDocument();
  });

  it("blocks a non-repairer from the repairer form even on its direct route", async () => {
    mocks.wallet = "GREGISTRAR";
    window.history.replaceState({}, "", "/repairer");
    render(<App view="repairer" />);
    await waitFor(() =>
      expect(mocks.hasRole).toHaveBeenCalledWith("Repairer", "GREGISTRAR"),
    );
    expect(screen.getByText(/Repairer access is required/)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Attest a repair" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Find a passport" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Register a device" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Invalid Stellar passport link/),
    ).not.toBeInTheDocument();
  });

  it("gives an authorized repairer all three actions", async () => {
    mocks.wallet = "GREPAIRER";
    mocks.hasRole.mockResolvedValue(true);
    render(<App view="repairer" />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Attest a repair" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { name: "Find a passport" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Register a device" }),
    ).toBeInTheDocument();
    mocks.hasRole.mockResolvedValue(false);
    fireEvent.focus(window);
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Attest a repair" }),
      ).not.toBeInTheDocument(),
    );
  });
});
