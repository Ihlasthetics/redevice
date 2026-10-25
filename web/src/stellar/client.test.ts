import { beforeEach, describe, expect, it, vi } from "vitest";
import { Networks, StrKey, contract, rpc } from "@stellar/stellar-sdk";
import {
  connectWallet,
  getConnectedWallet,
  deviceExplorerUrl,
  parsePassportPath,
  passportPath,
  publicPassportUrl,
  requireContractId,
  transactionExplorerUrl,
} from "./client";

const wallet = vi.hoisted(() => ({
  requestAccess: vi.fn(),
  getNetwork: vi.fn(),
  getAddress: vi.fn(),
  isAllowed: vi.fn(),
  signTransaction: vi.fn(),
}));
vi.mock("@stellar/freighter-api", () => wallet);

const contractId = StrKey.encodeContract(new Uint8Array(32).fill(7));
const account = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(8));

beforeEach(() => {
  vi.clearAllMocks();
  wallet.requestAccess.mockResolvedValue({ address: account });
  wallet.getNetwork.mockResolvedValue({
    network: "TESTNET",
    networkPassphrase: Networks.TESTNET,
  });
  wallet.getAddress.mockResolvedValue({ address: account });
  wallet.isAllowed.mockResolvedValue({ isAllowed: true });
});

describe("Stellar public identity", () => {
  it("requires the exact five digit ID in the new contract mode", async () => {
    vi.stubEnv("VITE_FIVE_DIGIT_IDS", "true");
    vi.resetModules();
    const { parseDeviceId } = await import("./client");
    expect(parseDeviceId("58342")).toBe("58342");
    expect(() => parseDeviceId("1")).toThrow("exactly five digits");
    expect(() => parseDeviceId("09999")).toThrow("exactly five digits");
    vi.unstubAllEnvs();
  });

  it("accepts a checksummed contract and canonical decimal device ID", () => {
    expect(requireContractId(contractId)).toBe(contractId);
    const path = passportPath("42", contractId);
    expect(parsePassportPath(path)).toEqual({ contractId, id: "42" });
    expect(deviceExplorerUrl("42", contractId)).toContain(
      `/contract/${contractId}`,
    );
  });

  it("rejects malformed paths, IDs, and public origins", () => {
    expect(parsePassportPath(`/passport/mainnet/${contractId}/1`)).toBeNull();
    expect(() =>
      parsePassportPath(`/passport/stellar-testnet/${contractId}/01`),
    ).toThrow();
    expect(() =>
      parsePassportPath(`/passport/stellar-testnet/CINVALID/1`),
    ).toThrow();
    expect(() => passportPath("0x123", contractId)).toThrow();
    expect(() => publicPassportUrl("1", "http://example.com")).toThrow();
    expect(() => publicPassportUrl("1", "https://example.com/path")).toThrow();
    expect(() => transactionExplorerUrl("invalid")).toThrow();
  });

  it("unwraps a paged Soroban Result for a public repair read", async () => {
    vi.stubEnv("VITE_STELLAR_CONTRACT_ID", contractId);
    vi.resetModules();
    const { getRepairs } = await import("./client");
    const query = vi
      .spyOn(rpc.Server.prototype, "queryContract")
      .mockResolvedValue({
        result: new contract.Ok([{ index: 0 }]),
        isReadCall: true,
      });
    await expect(getRepairs("1", 1)).resolves.toEqual([{ index: 0 }]);
    expect(query).toHaveBeenCalledWith(
      expect.any(String),
      "get_repairs",
      { device_id: 1n, start: 0, limit: 1 },
      Networks.TESTNET,
    );
    query.mockRestore();
    vi.unstubAllEnvs();
  });
});

describe("Freighter connection", () => {
  it("rejects the wrong network", async () => {
    wallet.getNetwork.mockResolvedValue({
      network: "PUBLIC",
      networkPassphrase: Networks.PUBLIC,
    });
    await expect(connectWallet()).rejects.toThrow(
      "Switch Freighter to Stellar Testnet",
    );
  });

  it("rejects a cancelled or malformed account response", async () => {
    wallet.requestAccess.mockResolvedValue({
      address: "",
      error: { message: "User rejected", code: -4 },
    });
    await expect(connectWallet()).rejects.toThrow("User rejected");
    wallet.requestAccess.mockResolvedValue({ address: "GINVALID" });
    await expect(connectWallet()).rejects.toThrow("valid account");
  });

  it("accepts an authorized Testnet connection", async () => {
    await expect(connectWallet()).resolves.toBe(account);
  });

  it("restores an allowed wallet without requesting access", async () => {
    await expect(getConnectedWallet()).resolves.toBe(account);
    expect(wallet.requestAccess).not.toHaveBeenCalled();
    wallet.isAllowed.mockResolvedValue({ isAllowed: false });
    await expect(getConnectedWallet()).resolves.toBeNull();
    expect(wallet.getAddress).toHaveBeenCalledTimes(1);
  });
});

describe("Soroban role authorization", () => {
  it("signs the admin auth entry before the transaction envelope", async () => {
    vi.stubEnv("VITE_STELLAR_CONTRACT_ID", contractId);
    vi.resetModules();
    const { write } = await import("./client");
    let authorized = false;
    const signAuthEntries = vi.fn(async () => {
      authorized = true;
    });
    const signAndSend = vi.fn(async () => {
      expect(authorized).toBe(true);
      return {
        sendTransactionResponse: { hash: "a".repeat(64) },
        getTransactionResponse: { status: "SUCCESS" },
        result: new contract.Ok(undefined),
      };
    });
    const from = vi.spyOn(contract.Client, "from").mockResolvedValue({
      grant_role: vi.fn(async () => ({
        isReadCall: false,
        needsNonInvokerSigningBy: () => (authorized ? [] : [account]),
        signAuthEntries,
        signAndSend,
      })),
    } as never);
    await write<void>(account, "grant_role", {
      admin: account,
      role: { tag: "Repairer" },
      account,
    });
    expect(signAuthEntries).toHaveBeenCalledWith({ address: account });
    expect(signAndSend).toHaveBeenCalledOnce();
    from.mockRestore();
    vi.unstubAllEnvs();
  });
});
