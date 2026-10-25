import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.hoisted(() => {
  vi.stubEnv("VITE_STELLAR_CONTRACT_ID", "");
});

vi.mock("@stellar/freighter-api", () => ({
  requestAccess: vi.fn(),
  getNetwork: vi.fn(),
  signTransaction: vi.fn(),
}));

describe("Stellar browser without a deployment", () => {
  it("shows the missing contract configuration and keeps writes disabled", () => {
    render(<App />);
    expect(
      screen.getByText(/Set VITE_STELLAR_CONTRACT_ID/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Register on Stellar" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Attest on Stellar" }),
    ).toBeDisabled();
    expect(
      screen.queryByText(/Live Stellar Testnet · device/),
    ).not.toBeInTheDocument();
  });
});
