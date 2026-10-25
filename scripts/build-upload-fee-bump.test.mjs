import assert from "node:assert/strict";
import test from "node:test";
import {
  Account,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  SorobanDataBuilder,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { buildUploadFeeBump } from "./build-upload-fee-bump.mjs";

test("a resource fee above uint32 fits a signed fee-bump envelope", () => {
  const signer = Keypair.random();
  const account = new Account(signer.publicKey(), "1");
  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.uploadContractWasm({
        wasm: Uint8Array.from([0, 97, 115, 109, 1, 0, 0, 0]),
      }),
    )
    .setTimeout(300)
    .build();
  const { inner, outer, resourceFee } = buildUploadFeeBump(
    transaction,
    {
      minResourceFee: "7410168288",
      transactionData: new SorobanDataBuilder().setResources(1000, 0, 8),
    },
    signer.publicKey(),
  );

  assert.equal(resourceFee, 7_410_168_288n);
  assert.equal(inner.fee, BASE_FEE);
  assert.equal(outer.fee, "7410168488");
  assert.equal(
    inner.toEnvelope().value.tx.ext.value.resourceFee.toString(),
    resourceFee.toString(),
  );

  inner.sign(signer);
  const signedOuter = TransactionBuilder.buildFeeBumpTransaction(
    signer.publicKey(),
    BASE_FEE,
    inner,
    Networks.TESTNET,
  );
  signedOuter.sign(signer);
  assert.equal(signedOuter.innerTransaction.signatures.length, 1);
  assert.equal(signedOuter.signatures.length, 1);
  assert.equal(signedOuter.fee, outer.fee);
});
