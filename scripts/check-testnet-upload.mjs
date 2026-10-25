import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BASE_FEE,
  Networks,
  Operation,
  TransactionBuilder,
  rpc,
} from "@stellar/stellar-sdk";
import { buildUploadFeeBump } from "./build-upload-fee-bump.mjs";

const MAX_TRANSACTION_FEE = 4_294_967_295n;
const RPC_URL = "https://soroban-testnet.stellar.org";
const WASM_PATH = resolve(
  "stellar/target/wasm32v1-none/release/redevice_stellar.wasm",
);
const accountId = process.argv[2];

if (!accountId) {
  console.error(
    "Usage: npm run testnet:preflight -- <funded-public-G-address>",
  );
  process.exitCode = 2;
} else {
  try {
    const server = new rpc.Server(RPC_URL);
    const account = await server.getAccount(accountId);
    const wasm = readFileSync(WASM_PATH);
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.uploadContractWasm({ wasm }))
      .setTimeout(300)
      .build();
    const simulation = await server.simulateTransaction(transaction);
    if (simulation.error || !simulation.minResourceFee) {
      throw new Error(simulation.error ?? "RPC returned no resource fee.");
    }
    const resourceFee = BigInt(simulation.minResourceFee);
    console.log(`WASM size: ${wasm.length} bytes`);
    console.log(`Simulated resource fee: ${resourceFee} stroops`);
    console.log(`Maximum transaction fee: ${MAX_TRANSACTION_FEE} stroops`);
    if (resourceFee + BigInt(BASE_FEE) > MAX_TRANSACTION_FEE) {
      const { inner, outer } = buildUploadFeeBump(
        transaction,
        simulation,
        accountId,
      );
      console.log(`Inner fee: ${inner.fee} stroops`);
      console.log(`Unsigned fee-bump fee: ${outer.fee} stroops`);
      console.log(
        "A fee-bump envelope can carry this resource fee. Both inner and outer envelopes must be signed, and the wallet must support this flow. Nothing was signed or submitted.",
      );
    } else {
      console.log(
        "Upload fee fits the transaction fee field. Re-simulate immediately before signing.",
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
