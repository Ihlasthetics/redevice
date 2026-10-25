import { describe, expect, it } from "vitest";
import {
  Account,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  SorobanDataBuilder,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { assembleUploadPreview, formatXlm } from "./deploy";

describe("Testnet upload fee bump", () => {
  it("puts a resource fee above uint32 in the outer envelope", () => {
    const account = Keypair.random().publicKey();
    const raw = new TransactionBuilder(new Account(account, "1"), {
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
    const preview = assembleUploadPreview(
      raw,
      new SorobanDataBuilder().setResources(1000, 0, 8),
      7_410_168_288n,
      account,
      "reviewed-hash",
    );

    expect(preview.inner.fee).toBe(BASE_FEE);
    expect(
      preview.inner.toEnvelope().value.tx.ext.value!.resourceFee.toString(),
    ).toBe("7410168288");
    expect(preview.fee).toBe(7_410_168_488n);
    expect(preview.inner.signatures).toHaveLength(0);
    expect(formatXlm(preview.fee)).toBe("741.0168488");
  });
});
