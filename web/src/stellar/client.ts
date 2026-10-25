import {
  getAddress,
  getNetwork,
  isAllowed,
  requestAccess,
  signAuthEntry,
  signTransaction,
} from "@stellar/freighter-api";
import { Networks, StrKey, contract, rpc } from "@stellar/stellar-sdk";
import {
  createSerialCommitment,
  normalizeSerialIdentity,
  parseStellarDeviceId,
} from "./identity";

export const NETWORK = Networks.TESTNET;
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const CONTRACT_ID =
  import.meta.env.VITE_STELLAR_CONTRACT_ID?.trim() ?? "";
export const FIVE_DIGIT_IDS = import.meta.env.VITE_FIVE_DIGIT_IDS === "true";
export type Status = "Used" | "Repaired" | "Refurbished" | "PartsOnly";
export type Device = {
  id: bigint;
  commitment_version: number;
  registrar: string;
  serial_commitment: Uint8Array;
  manufacturer_namespace: string;
  product_namespace: string;
  brand: string;
  model: string;
  masked_serial: string;
  status: { tag: Status };
  registered_at: bigint;
  repair_count: number;
};
export type Repair = {
  device_id: bigint;
  index: number;
  repairer: string;
  repair_type: string;
  notes: string;
  previous_status: { tag: Status };
  next_status: { tag: Status };
  battery_health: number | null;
  claimed_service_time: bigint | null;
  attested_at: bigint;
};

const server = new rpc.Server(RPC_URL);

export function requireContractId(value = CONTRACT_ID) {
  if (!StrKey.isValidContract(value))
    throw new Error(
      "Set VITE_STELLAR_CONTRACT_ID to the deployed Testnet C-address.",
    );
  return value;
}

export function parseDeviceId(value: string) {
  if (FIVE_DIGIT_IDS && !/^[1-9][0-9]{4}$/.test(value))
    throw new Error("Device ID must be exactly five digits.");
  return parseStellarDeviceId(value);
}

export function passportPath(id: string, contractId = requireContractId()) {
  return `/passport/stellar-testnet/${contractId}/${parseDeviceId(id)}`;
}

export function publicPassportUrl(id: string, configuredOrigin?: string) {
  const origin = new URL(configuredOrigin || window.location.origin);
  if (
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/" ||
    (origin.protocol !== "https:" &&
      !(
        origin.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
      ))
  )
    throw new Error(
      "VITE_PUBLIC_APP_ORIGIN must be an HTTPS origin (or local HTTP for testing).",
    );
  return new URL(passportPath(id), origin).toString();
}

export function parsePassportPath(
  path: string,
): { contractId: string; id: string } | null {
  const parts = path.split("/");
  if (
    parts.length !== 5 ||
    parts[0] !== "" ||
    parts[1] !== "passport" ||
    parts[2] !== "stellar-testnet"
  )
    return null;
  return {
    contractId: requireContractId(parts[3]),
    id: parseDeviceId(parts[4]),
  };
}

export function deviceExplorerUrl(
  id: string,
  contractId = requireContractId(),
) {
  parseDeviceId(id);
  return `https://stellar.expert/explorer/testnet/contract/${contractId}`;
}

export function transactionExplorerUrl(hash: string) {
  if (!/^[0-9a-f]{64}$/i.test(hash))
    throw new Error("Invalid transaction hash.");
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

async function read<T>(
  method: string,
  args: Record<string, unknown>,
): Promise<T> {
  const result = await server.queryContract<T>(
    requireContractId(),
    method,
    args,
    NETWORK,
  );
  if (!result.isReadCall)
    throw new Error(`${method} was not a read-only contract call.`);
  return result.result;
}

export async function getDevice(id: string) {
  return read<Device | null>("get_device", {
    device_id: BigInt(parseDeviceId(id)),
  });
}

export async function getRepairs(id: string, count: number) {
  if (!Number.isSafeInteger(count) || count < 0)
    throw new Error("Invalid repair count.");
  const pages: Repair[] = [];
  for (let start = 0; start < count; start += 20) {
    pages.push(
      ...(
        await read<contract.Result<Repair[]>>("get_repairs", {
          device_id: BigInt(parseDeviceId(id)),
          start,
          limit: Math.min(20, count - start),
        })
      ).unwrap(),
    );
  }
  return pages;
}

export async function hasRole(role: "Registrar" | "Repairer", account: string) {
  if (!StrKey.isValidEd25519PublicKey(account))
    throw new Error("Invalid wallet address.");
  return read<boolean>("has_role", { role: { tag: role }, account });
}

export async function getAdministrator() {
  return read<string>("admin", {});
}

export async function connectWallet() {
  const access = await requestAccess();
  if (access.error || !StrKey.isValidEd25519PublicKey(access.address))
    throw new Error(
      access.error?.message ?? "Freighter did not return a valid account.",
    );
  await assertWallet(access.address);
  return access.address;
}

export async function getConnectedWallet(): Promise<string | null> {
  const permission = await isAllowed();
  if (permission.error || !permission.isAllowed) return null;
  const [current, network] = await Promise.all([getAddress(), getNetwork()]);
  if (
    current.error ||
    !StrKey.isValidEd25519PublicKey(current.address) ||
    network.error ||
    network.networkPassphrase !== NETWORK
  )
    return null;
  return current.address;
}

async function assertWallet(account: string) {
  const network = await getNetwork();
  if (network.error) throw new Error(network.error.message);
  if (network.networkPassphrase !== NETWORK)
    throw new Error("Switch Freighter to Stellar Testnet before signing.");
  return account;
}

type WriteMethods = {
  register_device: (
    args: Record<string, unknown>,
    options?: contract.MethodOptions,
  ) => Promise<contract.AssembledTransaction<contract.Result<bigint>>>;
  attest_repair: (
    args: Record<string, unknown>,
    options?: contract.MethodOptions,
  ) => Promise<contract.AssembledTransaction<contract.Result<number>>>;
  grant_role: (
    args: Record<string, unknown>,
    options?: contract.MethodOptions,
  ) => Promise<contract.AssembledTransaction<contract.Result<void>>>;
  revoke_role: (
    args: Record<string, unknown>,
    options?: contract.MethodOptions,
  ) => Promise<contract.AssembledTransaction<contract.Result<void>>>;
};

export async function write<T extends bigint | number | void>(
  account: string,
  method: keyof WriteMethods,
  args: Record<string, unknown>,
): Promise<{ result: T; hash: string }> {
  await assertWallet(account);
  const client = await contract.Client.from<WriteMethods>({
    contractId: requireContractId(),
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK,
    publicKey: account,
    signTransaction: async (xdr, options) => {
      await assertWallet(account);
      const signed = await signTransaction(xdr, {
        ...options,
        networkPassphrase: NETWORK,
        address: account,
      });
      if (
        signed.error ||
        !signed.signedTxXdr ||
        signed.signerAddress !== account
      )
        throw new Error(
          signed.error?.message ??
            "Freighter did not sign with the selected account.",
        );
      return signed;
    },
    signAuthEntry: async (entry, options) => {
      await assertWallet(account);
      const signed = await signAuthEntry(entry, {
        ...options,
        networkPassphrase: NETWORK,
        address: account,
      });
      if (
        signed.error ||
        !signed.signedAuthEntry ||
        signed.signerAddress !== account
      )
        throw new Error(
          signed.error?.message ??
            "Freighter did not authorize with the selected account.",
        );
      return {
        signedAuthEntry: signed.signedAuthEntry,
        signerAddress: signed.signerAddress,
      };
    },
  });
  const tx = await client[method](args, { timeoutInSeconds: 45 });
  if (tx.isReadCall) throw new Error("Expected a write transaction.");
  const unsigned = tx.needsNonInvokerSigningBy();
  if (unsigned.length) {
    if (unsigned.length !== 1 || unsigned[0] !== account)
      throw new Error(
        `Transaction needs authorization from ${unsigned.join(", ")}.`,
      );
    await tx.signAuthEntries({ address: account });
    if (tx.needsNonInvokerSigningBy().length)
      throw new Error("Soroban authorization is still unsigned.");
  }
  let submittedHash: string | undefined;
  const sent = await tx
    .signAndSend({
      watcher: {
        onSubmitted(response) {
          submittedHash = response?.hash;
        },
      },
    })
    .catch((cause: unknown) => {
      if (submittedHash)
        throw new Error(
          `Transaction ${submittedHash} may have been submitted. Check its final status before retrying. ${cause instanceof Error ? cause.message : ""}`,
        );
      throw cause;
    });
  const hash = sent.sendTransactionResponse?.hash;
  if (hash && sent.getTransactionResponse?.status === "FAILED")
    throw new Error(
      `Transaction ${hash} failed on Stellar Testnet. Review its result before retrying.`,
    );
  if (!hash || sent.getTransactionResponse?.status !== "SUCCESS")
    throw new Error(
      `Transaction finality is unknown${hash ? ` (${hash})` : ""}. Check the explorer before retrying.`,
    );
  return { result: sent.result.unwrap() as T, hash };
}

export async function changeRepairerRole(
  admin: string,
  account: string,
  grant: boolean,
) {
  if (!StrKey.isValidEd25519PublicKey(account))
    throw new Error("Enter a valid repairer wallet address.");
  if ((await getAdministrator()) !== admin)
    throw new Error(
      "The connected wallet is not this contract's administrator.",
    );
  const current = await hasRole("Repairer", account);
  if (current === grant)
    throw new Error(
      grant
        ? "This account is already a repairer."
        : "This account is not a repairer.",
    );
  return write<void>(admin, grant ? "grant_role" : "revoke_role", {
    admin,
    role: { tag: "Repairer" },
    account,
  });
}

function requestId(key: string) {
  const existing = localStorage.getItem(key);
  if (existing && /^[0-9a-f]{64}$/.test(existing))
    return Uint8Array.from(
      existing.match(/../g)!.map((byte) => parseInt(byte, 16)),
    );
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(
    key,
    Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""),
  );
  return bytes;
}

export async function registerDevice(
  account: string,
  fields: {
    manufacturer: string;
    product: string;
    serial: string;
    brand: string;
    model: string;
    maskedSerial: string;
    status: "Used" | "Refurbished";
  },
) {
  const identity = normalizeSerialIdentity({
    manufacturerNamespace: fields.manufacturer,
    productNamespace: fields.product,
    serial: fields.serial,
  });
  const commitment = await createSerialCommitment(identity);
  const key = `redevice:stellar:register:${CONTRACT_ID}:${account}:${JSON.stringify({ commitment, brand: fields.brand.trim(), model: fields.model.trim(), maskedSerial: fields.maskedSerial.trim(), status: fields.status })}`;
  const result = await write<bigint>(account, "register_device", {
    registrar: account,
    request_id: requestId(key),
    serial_commitment: Uint8Array.from(
      commitment.match(/../g)!.map((byte) => parseInt(byte, 16)),
    ),
    manufacturer_namespace: identity.manufacturerNamespace,
    product_namespace: identity.productNamespace,
    brand: fields.brand.trim(),
    model: fields.model.trim(),
    masked_serial: fields.maskedSerial.trim(),
    status: { tag: fields.status },
  });
  localStorage.removeItem(key);
  return result;
}

export async function attestRepair(
  account: string,
  fields: {
    deviceId: string;
    repairType: string;
    notes: string;
    status: Status;
    batteryHealth?: number;
    claimedTime?: bigint;
  },
) {
  const payload = JSON.stringify({
    ...fields,
    claimedTime: fields.claimedTime?.toString(),
  });
  const key = `redevice:stellar:repair:${CONTRACT_ID}:${account}:${payload}`;
  const result = await write<number>(account, "attest_repair", {
    repairer: account,
    request_id: requestId(key),
    device_id: BigInt(parseDeviceId(fields.deviceId)),
    repair_type: fields.repairType.trim(),
    notes: fields.notes.trim(),
    next_status: { tag: fields.status },
    battery_health: fields.batteryHealth,
    claimed_service_time: fields.claimedTime,
  });
  localStorage.removeItem(key);
  return result;
}
