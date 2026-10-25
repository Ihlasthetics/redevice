import {
  getNetwork,
  requestAccess,
  signAuthEntry,
  signTransaction,
} from "@stellar/freighter-api";
import {
  BASE_FEE,
  Networks,
  Operation,
  TransactionBuilder,
  contract,
  rpc,
  xdr,
  type SorobanDataBuilder,
  type Transaction,
} from "@stellar/stellar-sdk";

const RPC_URL = "https://soroban-testnet.stellar.org";
const EXPECTED_WASM_SHA256 =
  "d5d3a7c0e9a92af5ff41b949ad28745bb9572143243076e4d11e91df456914eb";
const server = new rpc.Server(RPC_URL);

export type UploadPreview = {
  account: string;
  inner: Transaction;
  wasmHash: string;
  fee: bigint;
  createdAt: number;
};

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function formatXlm(stroops: bigint) {
  const whole = stroops / 10_000_000n;
  const fractional = (stroops % 10_000_000n)
    .toString()
    .padStart(7, "0")
    .replace(/0+$/, "");
  return `${whole}${fractional ? `.${fractional}` : ""}`;
}

async function assertWallet(account: string) {
  const access = await requestAccess();
  if (access.error || access.address !== account)
    throw new Error("Reconnect the same Freighter account before signing.");
  const network = await getNetwork();
  if (network.error || network.networkPassphrase !== Networks.TESTNET)
    throw new Error("Switch Freighter to Testnet before signing.");
}

export async function connectDeployWallet() {
  const access = await requestAccess();
  if (access.error || !access.address)
    throw new Error(access.error?.message ?? "Freighter did not connect.");
  const network = await getNetwork();
  if (network.error || network.networkPassphrase !== Networks.TESTNET)
    throw new Error("Switch Freighter to Testnet before continuing.");
  return access.address;
}

async function signWithFreighter(xdrText: string, account: string) {
  await assertWallet(account);
  const signed = await signTransaction(xdrText, {
    networkPassphrase: Networks.TESTNET,
    address: account,
  });
  if (signed.error || !signed.signedTxXdr || signed.signerAddress !== account)
    throw new Error(
      signed.error?.message ?? "Freighter did not sign with this account.",
    );
  return signed.signedTxXdr;
}

export async function previewUpload(wasm: Uint8Array, account: string) {
  await assertWallet(account);
  const wasmHash = hex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", Uint8Array.from(wasm).buffer),
    ),
  );
  if (wasmHash !== EXPECTED_WASM_SHA256)
    throw new Error("This is not the reviewed ReDevice contract WASM.");
  const source = await server.getAccount(account);
  const raw = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.uploadContractWasm({ wasm }))
    .setTimeout(300)
    .build();
  const simulation = await server.simulateTransaction(raw);
  if (!rpc.Api.isSimulationSuccess(simulation))
    throw new Error(simulation.error ?? "Upload simulation was incomplete.");
  return assembleUploadPreview(
    raw,
    simulation.transactionData,
    BigInt(simulation.minResourceFee),
    account,
    wasmHash,
  );
}

export function assembleUploadPreview(
  raw: Transaction,
  transactionData: SorobanDataBuilder,
  resourceFee: bigint,
  account: string,
  wasmHash: string,
): UploadPreview {
  if (resourceFee <= 0n) throw new Error("Invalid simulated resource fee.");
  const rawEnvelope = raw.toEnvelope();
  if (rawEnvelope.type !== "envelopeTypeTx")
    throw new Error("Expected a modern Stellar transaction envelope.");
  const envelope = xdr.TransactionEnvelope.envelopeTypeTx(
    new xdr.TransactionV1Envelope({
      tx: new xdr.Transaction({
        ...rawEnvelope.value.tx,
        ext: xdr.TransactionExt.sorobanData(
          transactionData.setResourceFee(resourceFee.toString()).build(),
        ),
      }),
      signatures: [],
    }),
  );
  const inner = TransactionBuilder.fromXDR(
    envelope.toXdr("base64"),
    Networks.TESTNET,
  ) as Transaction;
  const outer = TransactionBuilder.buildFeeBumpTransaction(
    account,
    BASE_FEE,
    inner,
    Networks.TESTNET,
  );
  return {
    account,
    inner,
    wasmHash,
    fee: BigInt(outer.fee),
    createdAt: Date.now(),
  } satisfies UploadPreview;
}

export async function submitUpload(
  preview: UploadPreview,
  onSubmitted: (hash: string) => void,
) {
  if (Date.now() - preview.createdAt > 120_000)
    throw new Error("Fee preview expired. Simulate the upload again.");
  const signedInner = TransactionBuilder.fromXDR(
    await signWithFreighter(preview.inner.toXDR(), preview.account),
    Networks.TESTNET,
  ) as Transaction;
  if (
    hex(signedInner.hash()) !== hex(preview.inner.hash()) ||
    signedInner.signatures.length === 0
  )
    throw new Error("Freighter changed or did not sign the inner transaction.");
  const outer = TransactionBuilder.buildFeeBumpTransaction(
    preview.account,
    BASE_FEE,
    signedInner,
    Networks.TESTNET,
  );
  if (BigInt(outer.fee) !== preview.fee)
    throw new Error("Fee changed. Simulate the upload again.");
  const signedOuter = TransactionBuilder.fromXDR(
    await signWithFreighter(outer.toXDR(), preview.account),
    Networks.TESTNET,
  );
  if (
    hex(signedOuter.hash()) !== hex(outer.hash()) ||
    signedOuter.signatures.length === 0
  )
    throw new Error("Freighter changed or did not sign the fee bump.");
  const sent = await server.sendTransaction(signedOuter);
  if (sent.status !== "PENDING")
    throw new Error(`Upload submission failed: ${sent.status}`);
  onSubmitted(sent.hash);
  const final = await server.pollTransaction(sent.hash, { attempts: 30 });
  if (final.status !== "SUCCESS")
    throw new Error(`Upload ${sent.hash} ended with ${final.status}.`);
  await verifyUploadedWasm();
  return { hash: sent.hash, wasmHash: preview.wasmHash };
}

export async function verifyUploadedWasm() {
  const uploaded = await server.getContractWasmByHash(
    EXPECTED_WASM_SHA256,
    "hex",
  );
  if (
    hex(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", Uint8Array.from(uploaded).buffer),
      ),
    ) !== EXPECTED_WASM_SHA256
  )
    throw new Error("Uploaded WASM readback differs from the reviewed build.");
  return EXPECTED_WASM_SHA256;
}

function walletSigner(account: string) {
  return async (xdrText: string) => ({
    signedTxXdr: await signWithFreighter(xdrText, account),
    signerAddress: account,
  });
}

export async function deployInstance(
  account: string,
  wasmHash: string,
  onSubmitted: (hash: string) => void,
) {
  await assertWallet(account);
  const tx = await contract.Client.deploy(
    { admin: account },
    {
      wasmHash,
      rpcUrl: RPC_URL,
      networkPassphrase: Networks.TESTNET,
      publicKey: account,
      signTransaction: walletSigner(account),
      timeoutInSeconds: 60,
    },
  );
  const sent = await tx.signAndSend({
    watcher: {
      onSubmitted: (response) => response && onSubmitted(response.hash),
    },
  });
  if (sent.getTransactionResponse?.status !== "SUCCESS")
    throw new Error(
      "Deployment finality is unknown. Check the transaction hash.",
    );
  return {
    contractId: sent.result.options.contractId,
    hash: sent.sendTransactionResponse?.hash ?? "",
  };
}

type RoleClient = {
  grant_role: (args: {
    admin: string;
    role: { tag: "Registrar" | "Repairer" };
    account: string;
  }) => Promise<contract.AssembledTransaction<contract.Result<void>>>;
};

export async function grantOwnRole(
  account: string,
  contractId: string,
  role: "Registrar" | "Repairer",
  onSubmitted: (hash: string) => void,
) {
  await assertWallet(account);
  const client = await contract.Client.from<RoleClient>({
    contractId,
    rpcUrl: RPC_URL,
    networkPassphrase: Networks.TESTNET,
    publicKey: account,
    signTransaction: walletSigner(account),
    signAuthEntry: async (entry, options) => {
      await assertWallet(account);
      const signed = await signAuthEntry(entry, {
        ...options,
        networkPassphrase: Networks.TESTNET,
        address: account,
      });
      if (
        signed.error ||
        !signed.signedAuthEntry ||
        signed.signerAddress !== account
      )
        throw new Error(
          signed.error?.message ??
            "Freighter did not authorize this role grant.",
        );
      return {
        signedAuthEntry: signed.signedAuthEntry,
        signerAddress: signed.signerAddress,
      };
    },
  });
  const tx = await client.grant_role({
    admin: account,
    role: { tag: role },
    account,
  });
  const unsigned = tx.needsNonInvokerSigningBy();
  if (unsigned.length) {
    if (unsigned.length !== 1 || unsigned[0] !== account)
      throw new Error(
        `Role grant needs authorization from ${unsigned.join(", ")}.`,
      );
    await tx.signAuthEntries({ address: account });
    if (tx.needsNonInvokerSigningBy().length)
      throw new Error("Role grant authorization is still unsigned.");
  }
  const sent = await tx.signAndSend({
    watcher: {
      onSubmitted: (response) => response && onSubmitted(response.hash),
    },
  });
  if (sent.getTransactionResponse?.status !== "SUCCESS")
    throw new Error(
      "Role grant finality is unknown. Check the transaction hash.",
    );
  sent.result.unwrap();
  return sent.sendTransactionResponse?.hash ?? "";
}
