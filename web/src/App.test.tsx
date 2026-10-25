import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TESTNET_PACKAGE_ID } from "./constants";
import {
  passportAdapter,
  PassportDataError,
  type PublicDevicePassport,
} from "./data/passport-adapter";

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
  default: ({
    onDemoRequested,
    onLookupRequested,
  }: {
    onDemoRequested: (passport: PublicDevicePassport) => void;
    onLookupRequested: (id: string) => void;
  }) => (
    <div>
      <button
        onClick={() => onDemoRequested(passportAdapter.getPublicPassport())}
      >
        Demo
      </button>
      <button onClick={() => onLookupRequested(`0x${"b".repeat(64)}`)}>
        Select B
      </button>
    </div>
  ),
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

  const view = render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

beforeEach(() => {
  mocks.loadPassport.mockReset();
  window.history.replaceState({}, "", "/");
});

describe("public passport routes", () => {
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

function pending<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it("keeps explicit demo selected when an earlier live read completes", async () => {
  const read = pending<PublicDevicePassport>();
  mocks.loadPassport.mockReturnValue(read.promise);
  window.history.replaceState({}, "", `/?passport=${passportId}`);
  renderApp();
  fireEvent.click(screen.getByText("Demo"));
  await act(async () => {
    read.resolve(livePassport);
  });
  expect(screen.getByText("Demo MacBook")).toBeVisible();
  expect(screen.getByText("Repair source: fixture")).toBeInTheDocument();
  expect(screen.queryByText("Live Sui Testnet")).not.toBeInTheDocument();
  expect(window.location.search).toBe("?demo=1");
});

it("keeps the newer selection when the older lookup completes last", async () => {
  const old = pending<PublicDevicePassport>();
  const idB = `0x${"b".repeat(64)}`;
  mocks.loadPassport.mockReturnValueOnce(old.promise).mockResolvedValueOnce({
    ...livePassport,
    id: idB,
    deviceName: "Device B",
  });
  window.history.replaceState({}, "", `/?passport=${passportId}`);
  renderApp();
  fireEvent.click(screen.getByText("Select B"));
  expect(await screen.findByText("Device B")).toBeVisible();
  await act(async () => {
    old.resolve(livePassport);
  });
  expect(screen.getByText("Device B")).toBeVisible();
  expect(screen.queryByText("Wallet-free laptop")).not.toBeInTheDocument();
});

it("follows browser Back and Forward between live and demo selections", async () => {
  mocks.loadPassport.mockResolvedValue(livePassport);
  window.history.replaceState({}, "", `/?passport=${passportId}`);
  renderApp();
  expect(await screen.findByText("Wallet-free laptop")).toBeVisible();
  fireEvent.click(screen.getByText("Demo"));
  act(() => window.history.back());
  await waitFor(() =>
    expect(screen.getByText("Wallet-free laptop")).toBeVisible(),
  );
  act(() => window.history.forward());
  await waitFor(() => expect(screen.getByText("Demo MacBook")).toBeVisible());
});

it("distinguishes incompatible objects and retries the live read", async () => {
  mocks.loadPassport
    .mockRejectedValueOnce(
      new PassportDataError(
        "missing-or-incompatible",
        "Object is missing or incompatible",
      ),
    )
    .mockResolvedValueOnce(livePassport);
  window.history.replaceState({}, "", `/?passport=${passportId}`);
  renderApp();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Object is missing or incompatible",
  );
  fireEvent.click(screen.getByText("Retry live read"));
  expect(await screen.findByText("Wallet-free laptop")).toBeVisible();
  expect(
    screen.getByText("No repair records have been recorded for this passport."),
  ).toBeVisible();
});

it("labels claimed and attested dates separately without inventing legacy dates", async () => {
  const record = passportAdapter.getPublicPassport().repairHistory[0];
  mocks.loadPassport.mockResolvedValue({
    ...livePassport,
    repairHistory: [
      {
        ...record,
        id: "attested",
        attestedAt: { isoDate: "2026-10-20", displayDate: "20 October 2026" },
      },
      { ...record, id: "legacy", attestedAt: undefined },
    ],
  });
  window.history.replaceState({}, "", `/?passport=${passportId}`);
  renderApp();
  await screen.findByText("Wallet-free laptop");
  expect(screen.getAllByText(/Claimed service date:/)).toHaveLength(2);
  expect(screen.getAllByText(/Ledger attestation date:/)).toHaveLength(1);
});

it("marks the same passport stale after a refresh failure and removes it when selection changes", async () => {
  mocks.loadPassport
    .mockResolvedValueOnce(livePassport)
    .mockRejectedValue(new Error("offline"));
  window.history.replaceState({}, "", `/?passport=${passportId}`);
  const { queryClient } = renderApp();
  await screen.findByText("Wallet-free laptop");
  await act(async () => {
    await queryClient.refetchQueries({
      queryKey: ["redevice", "passport", passportId],
    });
  });
  expect(await screen.findByText("Stale Sui Testnet data")).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "last successful live read",
  );
  fireEvent.click(screen.getByText("Select B"));
  await screen.findByRole("alert");
  expect(screen.queryByText("Wallet-free laptop")).not.toBeInTheDocument();
});
