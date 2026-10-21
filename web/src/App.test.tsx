import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TESTNET_PACKAGE_ID } from "./constants";
import type { PublicDevicePassport } from "./data/passport-adapter";

const mocks = vi.hoisted(() => ({
  client: { core: {} },
  loadPassport: vi.fn(),
}));

vi.mock("@mysten/dapp-kit-react", () => ({
  useCurrentClient: () => mocks.client,
}));

vi.mock("@mysten/dapp-kit-react/ui", () => ({
  ConnectButton: () => <button type="button">Connect wallet</button>,
}));

vi.mock("./data/sui-passport", () => ({
  loadTestnetPassport: mocks.loadPassport,
}));

vi.mock("./components/DeviceRegistration", () => ({
  default: () => <div>Registration area</div>,
}));

vi.mock("./components/QrPassportScanner", () => ({
  default: () => <div>Public scanner</div>,
}));

vi.mock("./components/PassportQrDownload", () => ({
  default: () => <div>QR download</div>,
}));

vi.mock("./components/RepairWorkspace", () => ({
  default: ({ passport }: { passport: PublicDevicePassport }) => (
    <div>Repair source: {passport.source.kind}</div>
  ),
}));

import App from "./App";

const passportId = `0x${"a".repeat(64)}`;
const livePassport: PublicDevicePassport = {
  id: passportId,
  manufacturer: "0xissuer",
  deviceName: "Wallet-free laptop",
  brand: "Example",
  model: "Laptop",
  category: "Laptop computer",
  maskedSerial: "ABC•••1234",
  serialHash: `0x${"b".repeat(64)}`,
  condition: "Used",
  coverageStart: { isoDate: "2026-10-15", displayDate: "15 October 2026" },
  verification: {
    label: "On-chain record",
    explanation: "Read from the configured package.",
  },
  repairHistory: [],
  source: {
    kind: "live",
    network: "Sui Testnet",
    objectType: `${TESTNET_PACKAGE_ID}::redevice::DevicePassport`,
    fetchedAt: "2026-10-15T10:00:00.000Z",
  },
};

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe("public passport routes", () => {
  beforeEach(() => {
    mocks.loadPassport.mockReset();
    window.history.replaceState({}, "", "/");
  });

  it("loads a valid public passport without asking for a wallet", async () => {
    window.history.replaceState({}, "", `/?passport=${passportId}`);
    mocks.loadPassport.mockResolvedValue(livePassport);

    renderApp();

    expect(await screen.findByText("Wallet-free laptop")).toBeInTheDocument();
    expect(mocks.loadPassport).toHaveBeenCalledWith(mocks.client, passportId);
    expect(screen.getByText("Live Sui Testnet")).toBeInTheDocument();
  });

  it("shows an actionable error for an invalid passport parameter", () => {
    window.history.replaceState({}, "", "/?passport=not-a-sui-id");

    renderApp();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The passport link is invalid",
    );
    expect(mocks.loadPassport).not.toHaveBeenCalled();
  });

  it("does not silently replace a failed live read with demo content", async () => {
    window.history.replaceState({}, "", `/?passport=${passportId}`);
    mocks.loadPassport.mockRejectedValue(new Error("RPC offline"));

    renderApp();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sui Testnet is unavailable",
    );
    expect(screen.getByText("Demo MacBook")).not.toBeVisible();
    expect(screen.queryByText("Live Sui Testnet")).not.toBeInTheDocument();
  });
});
