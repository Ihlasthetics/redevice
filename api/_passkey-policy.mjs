import { Address, StrKey, xdr } from "@stellar/stellar-sdk";

const SHARED_DEPLOYER =
  "GAAH4OT36RRCCAGKARGPN2HLHT2NOBVFHO4GUHA6CF7UKQ4MMV24WQ4N";
const MAX_BODY_BYTES = 48_000;

function addressCredential(entry) {
  const credentials = entry.credentials;
  if (
    credentials.type !== "sorobanCredentialsAddress" &&
    credentials.type !== "sorobanCredentialsAddressV2"
  )
    throw new Error("Only signed address credentials are allowed.");
  const value =
    credentials.type === "sorobanCredentialsAddress"
      ? credentials.address
      : credentials.addressV2;
  if (value.signature.type === "scvVoid")
    throw new Error("Authorization entry is unsigned.");
  return Address.fromScAddress(value.address).toString();
}

export function validateSpikePayload(payload, policy) {
  if (!payload || typeof payload !== "object")
    throw new Error("Missing sponsor payload.");
  if (
    typeof payload.func !== "string" ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(payload.func) ||
    !Array.isArray(payload.auth) ||
    payload.auth.length !== 1 ||
    typeof payload.auth[0] !== "string"
  )
    throw new Error("Expected one host function and one authorization entry.");
  if (Buffer.byteLength(JSON.stringify(payload)) > MAX_BODY_BYTES)
    throw new Error("Sponsor payload is too large.");

  let func;
  let entry;
  try {
    func = xdr.HostFunction.fromXdr(payload.func, "base64");
    entry = xdr.SorobanAuthorizationEntry.fromXdr(payload.auth[0], "base64");
  } catch {
    throw new Error("Invalid Soroban XDR.");
  }
  if (entry.rootInvocation.subInvocations.length)
    throw new Error("Nested authorization is not allowed in this spike.");
  const signer = addressCredential(entry);

  if (func.type === "hostFunctionTypeCreateContractV2") {
    if (!policy.allowCreation)
      throw new Error("Account creation is not enabled.");
    const create = func.createContractV2;
    if (
      create.executable.type !== "contractExecutableWasm" ||
      create.executable.wasmHash.toString() !== policy.accountWasmHash ||
      create.contractIdPreimage.type !== "contractIdPreimageFromAddress" ||
      Address.fromScAddress(
        create.contractIdPreimage.fromAddress.address,
      ).toString() !== SHARED_DEPLOYER ||
      signer !== SHARED_DEPLOYER ||
      entry.rootInvocation.function.type !==
        "sorobanAuthorizedFunctionTypeCreateContractV2HostFn" ||
      entry.rootInvocation.function.createContractV2HostFn.toXdr("base64") !==
        create.toXdr("base64")
    )
      throw new Error("Unapproved smart-account deployment.");
    return "create";
  }

  if (func.type !== "hostFunctionTypeInvokeContract")
    throw new Error("Only account creation or repair attestation is allowed.");
  const call = func.invokeContract;
  const expectedRepairer =
    policy.repairerAddress ||
    (policy.allowApprovedRepairer && StrKey.isValidContract(signer)
      ? signer
      : "");
  if (
    Address.fromScAddress(call.contractAddress).toString() !==
      policy.redeviceContractId ||
    call.functionName.toString() !== "attest_repair" ||
    call.args.length !== 8 ||
    !expectedRepairer ||
    signer !== expectedRepairer ||
    Address.fromScAddress(call.args[0].address).toString() !==
      expectedRepairer ||
    entry.rootInvocation.function.type !==
      "sorobanAuthorizedFunctionTypeContractFn" ||
    entry.rootInvocation.function.contractFn.toXdr("base64") !==
      call.toXdr("base64")
  )
    throw new Error("Unapproved repair attestation.");
  return "repair";
}
