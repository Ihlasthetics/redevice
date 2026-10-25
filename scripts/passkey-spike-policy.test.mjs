import assert from "node:assert/strict";
import { test } from "node:test";
import { Address, xdr } from "@stellar/stellar-sdk";
import { validateSpikePayload } from "../api/_passkey-policy.mjs";

const contractId = "CCHXDDGMOZNABGIYGBOIWCFHD3RECIKI2UWJKMOGRBCSSIL6YACCX6WJ";
const repairer = Address.fromString(contractId);
const deployer = Address.fromString(
  "GAAH4OT36RRCCAGKARGPN2HLHT2NOBVFHO4GUHA6CF7UKQ4MMV24WQ4N",
);
const wasmHash =
  "1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a";
const policy = {
  accountWasmHash: wasmHash,
  redeviceContractId: contractId,
  repairerAddress: contractId,
  allowCreation: true,
};

function entry(signer, authorizedFunction) {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: signer.toScAddress(),
        nonce: 1n,
        signatureExpirationLedger: 100,
        signature: xdr.ScVal.scvBytes(new Uint8Array([1])),
      }),
    ),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: authorizedFunction,
      subInvocations: [],
    }),
  }).toXdr("base64");
}

function repairPayload(method = "attest_repair", authorizedMethod = method) {
  const args = [
    xdr.ScVal.scvAddress(repairer.toScAddress()),
    xdr.ScVal.scvBytes(new Uint8Array(32).fill(1)),
    xdr.ScVal.scvU64(1n),
    xdr.ScVal.scvString("screen"),
    xdr.ScVal.scvString("replaced"),
    xdr.ScVal.scvSymbol("Repaired"),
    xdr.ScVal.scvVoid(),
    xdr.ScVal.scvVoid(),
  ];
  const call = new xdr.InvokeContractArgs({
    contractAddress: Address.fromString(contractId).toScAddress(),
    functionName: method,
    args,
  });
  return {
    func: xdr.HostFunction.hostFunctionTypeInvokeContract(call).toXdr("base64"),
    auth: [
      entry(
        repairer,
        xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
          new xdr.InvokeContractArgs({
            contractAddress: call.contractAddress,
            functionName: authorizedMethod,
            args,
          }),
        ),
      ),
    ],
  };
}

function creationPayload(hash = wasmHash) {
  const create = new xdr.CreateContractArgsV2({
    contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
      new xdr.ContractIdPreimageFromAddress({
        address: deployer.toScAddress(),
        salt: new Uint8Array(32).fill(2),
      }),
    ),
    executable: xdr.ContractExecutable.contractExecutableWasm(hash),
    constructorArgs: [],
  });
  return {
    func: xdr.HostFunction.hostFunctionTypeCreateContractV2(create).toXdr(
      "base64",
    ),
    auth: [
      entry(
        deployer,
        xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeCreateContractV2HostFn(
          create,
        ),
      ),
    ],
  };
}

test("permits only the pinned smart-account creation", () => {
  assert.equal(validateSpikePayload(creationPayload(), policy), "create");
  assert.throws(
    () => validateSpikePayload(creationPayload("00".repeat(32)), policy),
    /Unapproved/,
  );
  assert.throws(
    () =>
      validateSpikePayload(creationPayload(), {
        ...policy,
        allowCreation: false,
      }),
    /not enabled/,
  );
});

test("permits only the matching repair invocation and signer", () => {
  assert.equal(validateSpikePayload(repairPayload(), policy), "repair");
  assert.equal(
    validateSpikePayload(repairPayload(), {
      ...policy,
      repairerAddress: "",
      allowApprovedRepairer: true,
    }),
    "repair",
  );
  assert.throws(
    () => validateSpikePayload(repairPayload("grant_role"), policy),
    /Unapproved/,
  );
  assert.throws(
    () =>
      validateSpikePayload(
        repairPayload("attest_repair", "grant_role"),
        policy,
      ),
    /Unapproved/,
  );
  assert.throws(
    () =>
      validateSpikePayload(repairPayload(), { ...policy, repairerAddress: "" }),
    /Unapproved/,
  );
  assert.throws(
    () =>
      validateSpikePayload(repairPayload(), {
        ...policy,
        repairerAddress: deployer.toString(),
      }),
    /Unapproved/,
  );
  const wrongSigner = repairPayload();
  const signedCall = xdr.SorobanAuthorizationEntry.fromXdr(
    wrongSigner.auth[0],
    "base64",
  ).rootInvocation.function;
  wrongSigner.auth = [entry(deployer, signedCall)];
  assert.throws(
    () =>
      validateSpikePayload(wrongSigner, {
        ...policy,
        repairerAddress: "",
        allowApprovedRepairer: true,
      }),
    /Unapproved/,
  );
});

test("rejects an operation whose arguments changed after authorization", () => {
  const payload = repairPayload();
  const call = xdr.HostFunction.fromXdr(payload.func, "base64").invokeContract;
  call.args[4] = xdr.ScVal.scvString("altered notes");
  assert.throws(
    () =>
      validateSpikePayload(
        {
          ...payload,
          func: xdr.HostFunction.hostFunctionTypeInvokeContract(call).toXdr(
            "base64",
          ),
        },
        policy,
      ),
    /Unapproved/,
  );
});

test("rejects malformed and oversized requests before forwarding", () => {
  assert.throws(
    () => validateSpikePayload({ func: "bad", auth: [] }, policy),
    /one authorization/,
  );
  assert.throws(
    () =>
      validateSpikePayload(
        { ...repairPayload(), ignored: "a".repeat(48_000) },
        policy,
      ),
    /too large/,
  );
});
