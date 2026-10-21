import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TESTNET_PACKAGE_ID } from "../constants";

const mocks = vi.hoisted(() => ({
  address: `0x${"1".repeat(64)}`,
  simulateTransaction: vi.fn(),
  signAndExecuteTransaction: vi.fn(),
  waitForTransaction: vi.fn(),
  getObject: vi.fn(),
  refetchAuthorization: vi.fn(),
}));

vi.mock("@mysten/dapp-kit-react", () => ({
  useCurrentAccount: () => ({ address: mocks.address }),
  useCurrentClient: () => ({
    core: {
      simulateTransaction: mocks.simulateTransaction,
      waitForTransaction: mocks.waitForTransaction,
      getObject: mocks.getObject,
    },
  }),
  useDAppKit: () => ({
    signAndExecuteTransaction: mocks.signAndExecuteTransaction,
  }),
}));

vi.mock("@mysten/dapp-kit-react/ui", () => ({
  ConnectButton: () => <button type="button">Connect wallet</button>,
}));

vi.mock("../hooks/use-registrar-authorization", () => ({
  useRegistrarAuthorization: () => ({
    data: true,
    error: null,
    isPending: false,
    isError: false,
    refetch: mocks.refetchAuthorization,
  }),
}));

vi.mock("./PassportQrDownload", () => ({
  default: () => <div>Passport QR</div>,
}));

import DeviceRegistration from "./DeviceRegistration";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function fillSerial() {
  fireEvent.change(screen.getByLabelText(/serial number/i), {
    target: { value: "ABC-123456" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /i reviewed/i }));
}

describe("device registration", () => {
  beforeEach(() => {
    mocks.address = `0x${"1".repeat(64)}`;
    mocks.simulateTransaction.mockReset();
    mocks.signAndExecuteTransaction.mockReset();
    mocks.waitForTransaction.mockReset();
    mocks.getObject.mockReset();
    mocks.refetchAuthorization.mockReset();
    mocks.refetchAuthorization.mockResolvedValue({ data: true, error: null });
    mocks.simulateTransaction.mockResolvedValue({ Transaction: {} });
    mocks.signAndExecuteTransaction.mockResolvedValue({
      Transaction: { digest: "registered-digest" },
    });
    mocks.waitForTransaction.mockResolvedValue({
      Transaction: {
        effects: {
          changedObjects: [
            { idOperation: "Created", objectId: `0x${"2".repeat(64)}` },
          ],
        },
      },
    });
    mocks.getObject.mockResolvedValue({
      object: {
        type: `${TESTNET_PACKAGE_ID}::redevice::DevicePassport`,
      },
    });
  });

  it("shows preparation and blocks rapid duplicate submissions", async () => {
    const simulation = deferred<{ Transaction: object }>();
    mocks.simulateTransaction.mockReturnValue(simulation.promise);
    render(<DeviceRegistration onPassportCreated={vi.fn()} />);
    fillSerial();

    const submit = screen.getByRole("button", {
      name: /sign and register device/i,
    });
    fireEvent.click(submit);
    expect(
      await screen.findByText(/preparing and simulating/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/serial number/i)).toBeDisabled();
    fireEvent.click(submit);
    await waitFor(() =>
      expect(mocks.simulateTransaction).toHaveBeenCalledOnce(),
    );
    expect(mocks.signAndExecuteTransaction).not.toHaveBeenCalled();

    await act(async () => {
      simulation.resolve({ Transaction: {} });
      await simulation.promise;
    });
    expect(mocks.signAndExecuteTransaction).toHaveBeenCalledOnce();
  });

  it("retains the digest and retries lookup without signing again", async () => {
    mocks.waitForTransaction.mockRejectedValueOnce(new Error("RPC offline"));
    const onPassportCreated = vi.fn();
    render(<DeviceRegistration onPassportCreated={onPassportCreated} />);
    fillSerial();
    fireEvent.click(
      screen.getByRole("button", { name: /sign and register device/i }),
    );

    expect(await screen.findByText("RPC offline")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /view transaction/i }),
    ).toHaveAttribute("href", expect.stringContaining("registered-digest"));
    fireEvent.click(
      screen.getByRole("button", { name: /retry passport lookup/i }),
    );
    await waitFor(() =>
      expect(mocks.waitForTransaction).toHaveBeenCalledTimes(2),
    );
    expect(
      await screen.findByText("Device registered on Sui Testnet"),
    ).toBeInTheDocument();
    expect(onPassportCreated).toHaveBeenCalledWith(`0x${"2".repeat(64)}`);
    expect(mocks.signAndExecuteTransaction).toHaveBeenCalledOnce();
  });

  it("does not assign a delayed signed result to a different wallet", async () => {
    const signing = deferred<{ Transaction: { digest: string } }>();
    mocks.signAndExecuteTransaction.mockReturnValue(signing.promise);
    const onPassportCreated = vi.fn();
    const view = render(
      <DeviceRegistration onPassportCreated={onPassportCreated} />,
    );
    fillSerial();
    fireEvent.click(
      screen.getByRole("button", { name: /sign and register device/i }),
    );
    await screen.findByRole("button", { name: /approve in wallet/i });

    mocks.address = `0x${"3".repeat(64)}`;
    view.rerender(<DeviceRegistration onPassportCreated={onPassportCreated} />);
    await act(async () => {
      signing.resolve({ Transaction: { digest: "old-wallet-digest" } });
      await signing.promise;
    });
    expect(onPassportCreated).not.toHaveBeenCalled();
    expect(mocks.waitForTransaction).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("link", { name: /view transaction/i }),
    ).not.toBeInTheDocument();

    mocks.address = `0x${"1".repeat(64)}`;
    view.rerender(<DeviceRegistration onPassportCreated={onPassportCreated} />);
    expect(
      await screen.findByRole("link", { name: /view transaction/i }),
    ).toHaveAttribute("href", expect.stringContaining("old-wallet-digest"));
  });

  it("does not sign when the final registrar check is revoked", async () => {
    mocks.refetchAuthorization.mockResolvedValue({ data: false, error: null });
    render(<DeviceRegistration onPassportCreated={vi.fn()} />);
    fillSerial();
    fireEvent.click(
      screen.getByRole("button", { name: /sign and register device/i }),
    );

    expect(
      await screen.findByText(/registrar permission is no longer confirmed/i),
    ).toBeInTheDocument();
    expect(mocks.signAndExecuteTransaction).not.toHaveBeenCalled();
  });

  it("requires a fresh review after editing and keeps earlier proof after cancellation", async () => {
    mocks.signAndExecuteTransaction
      .mockResolvedValueOnce({ Transaction: { digest: "first-digest" } })
      .mockRejectedValueOnce(new Error("User rejected request"));
    render(<DeviceRegistration onPassportCreated={vi.fn()} />);
    fillSerial();
    fireEvent.click(
      screen.getByRole("button", { name: /sign and register device/i }),
    );
    expect(
      await screen.findByText("Device registered on Sui Testnet"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/serial number/i), {
      target: { value: "NEW-123456" },
    });
    expect(
      screen.getByRole("checkbox", { name: /i reviewed/i }),
    ).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: /i reviewed/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /register another device/i }),
    );

    expect(
      await screen.findByText(/wallet signature was cancelled/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /view earlier confirmed registration transaction/i,
      }),
    ).toHaveAttribute("href", expect.stringContaining("first-digest"));
  });

  it("restores readback proof after switching away and back before lookup finishes", async () => {
    const readback = deferred<{
      Transaction: {
        effects: {
          changedObjects: { idOperation: string; objectId: string }[];
        };
      };
    }>();
    mocks.waitForTransaction.mockReturnValue(readback.promise);
    const onPassportCreated = vi.fn();
    const view = render(
      <DeviceRegistration onPassportCreated={onPassportCreated} />,
    );
    fillSerial();
    fireEvent.click(
      screen.getByRole("button", { name: /sign and register device/i }),
    );
    await waitFor(() =>
      expect(mocks.waitForTransaction).toHaveBeenCalledOnce(),
    );

    mocks.address = `0x${"3".repeat(64)}`;
    view.rerender(<DeviceRegistration onPassportCreated={onPassportCreated} />);
    mocks.address = `0x${"1".repeat(64)}`;
    view.rerender(<DeviceRegistration onPassportCreated={onPassportCreated} />);

    await act(async () => {
      readback.resolve({
        Transaction: {
          effects: {
            changedObjects: [
              { idOperation: "Created", objectId: `0x${"2".repeat(64)}` },
            ],
          },
        },
      });
      await readback.promise;
    });
    expect(
      await screen.findByText("Device registered on Sui Testnet"),
    ).toBeInTheDocument();
    expect(onPassportCreated).not.toHaveBeenCalled();
  });

  it("reports a failed final execution without calling it a confirmed registration", async () => {
    mocks.waitForTransaction.mockResolvedValue({
      FailedTransaction: {
        status: { error: { message: "Move abort" } },
      },
    });
    const onPassportCreated = vi.fn();
    render(<DeviceRegistration onPassportCreated={onPassportCreated} />);
    fillSerial();
    fireEvent.click(
      screen.getByRole("button", { name: /sign and register device/i }),
    );

    expect(await screen.findByText("Move abort")).toBeInTheDocument();
    expect(onPassportCreated).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Device registered on Sui Testnet"),
    ).not.toBeInTheDocument();
  });
});
