import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { passportAdapter } from "../data/passport-adapter";

vi.mock("@mysten/dapp-kit-react", () => ({
  useCurrentAccount: () => ({ address: `0x${"1".repeat(64)}` }),
  useDAppKit: () => ({ signAndExecuteTransaction: vi.fn() }),
}));

vi.mock("@mysten/dapp-kit-react/ui", () => ({
  ConnectButton: () => <button type="button">Connect wallet</button>,
}));

vi.mock("../hooks/use-repairer-authorization", () => ({
  useRepairerAuthorization: () => ({ data: true, error: null }),
}));

import RepairWorkspace from "./RepairWorkspace";

describe("repair actions", () => {
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
});
