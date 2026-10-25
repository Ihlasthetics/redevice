import { BASE_FEE, TransactionBuilder, xdr } from "@stellar/stellar-sdk";

/**
 * Assemble an unsigned upload fee bump from an unsigned upload transaction and
 * its RPC simulation. The inner fee intentionally stays at the classic base
 * fee: protocol 23+ permits the outer int64 fee to cover the resource fee.
 */
export function buildUploadFeeBump(transaction, simulation, feeSource) {
  if (
    simulation.error ||
    !simulation.transactionData ||
    !simulation.minResourceFee
  ) {
    throw new Error(simulation.error ?? "Upload simulation is incomplete.");
  }
  if (
    transaction.operations.length !== 1 ||
    transaction.operations[0].type !== "invokeHostFunction" ||
    transaction.operations[0].func.type !== "hostFunctionTypeUploadContractWasm"
  ) {
    throw new Error("Expected a single contract upload operation.");
  }
  const resourceFee = BigInt(simulation.minResourceFee);
  if (resourceFee <= 0n) {
    throw new Error("Simulated resource fee must be positive.");
  }
  const envelope = transaction.toEnvelope();
  const data = simulation.transactionData
    .setResourceFee(resourceFee.toString())
    .build();
  envelope.value.tx.ext = xdr.TransactionExt.sorobanData(data);
  const inner = TransactionBuilder.fromXDR(
    envelope.toXdr("base64"),
    transaction.networkPassphrase,
  );
  const outer = TransactionBuilder.buildFeeBumpTransaction(
    feeSource,
    BASE_FEE,
    inner,
    transaction.networkPassphrase,
  );
  return { inner, outer, resourceFee };
}
