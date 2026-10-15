import type { SuiGrpcClient } from "@mysten/sui/grpc";
import {
  TESTNET_ADMIN_CAP_ID,
  TESTNET_PACKAGE_ID,
  TESTNET_PASSPORT_ID,
  TESTNET_REGISTRAR_CAP_ID,
  TESTNET_REPAIRER_CAP_ID,
} from "../constants";
import {
  PassportDataError,
  passportAdapter,
  type PublicDevicePassport,
} from "./passport-adapter";

const SUI_OBJECT_ID = /^0x[0-9a-f]{64}$/i;

function assertConfiguredObjectId(value: string, label: string) {
  if (!SUI_OBJECT_ID.test(value)) {
    throw new PassportDataError(
      "invalid-config",
      `${label} is not a valid Sui object ID. Update the matching Vite environment variable.`,
    );
  }
}

function expectedType(typeName: string) {
  return `${TESTNET_PACKAGE_ID}::redevice::${typeName}`;
}

function classifyReadFailure(
  error: unknown,
  subject: string,
): PassportDataError {
  if (error instanceof PassportDataError) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Unknown RPC error";

  if (/not[ -]?found|does not exist|deleted|wrapped/i.test(message)) {
    return new PassportDataError(
      "missing-or-incompatible",
      `${subject} was not found on Sui Testnet. Check the object ID and configured network.`,
    );
  }

  return new PassportDataError(
    "rpc-unavailable",
    `Sui Testnet could not be reached while reading ${subject}. The record and permissions remain unverified.`,
  );
}

function assertObjectType(
  actualType: unknown,
  typeName: string,
  label: string,
) {
  const expected = expectedType(typeName);

  if (
    typeof actualType !== "string" ||
    actualType.toLowerCase() !== expected.toLowerCase()
  ) {
    throw new PassportDataError(
      "invalid-config",
      `${label} has type ${actualType || "unknown"}; expected ${expected}. Check the configured package and capability IDs.`,
    );
  }
}

export async function loadTestnetPassport(
  client: SuiGrpcClient,
  objectId = TESTNET_PASSPORT_ID,
): Promise<PublicDevicePassport> {
  assertConfiguredObjectId(TESTNET_PACKAGE_ID, "VITE_SUI_PACKAGE_ID");
  assertConfiguredObjectId(objectId, "Passport ID");

  try {
    const { object } = await client.core.getObject({
      objectId,
      include: {
        json: true,
        previousTransaction: true,
      },
    });

    return passportAdapter.fromSuiObject(object);
  } catch (error) {
    throw classifyReadFailure(error, "the passport");
  }
}

export async function checkRepairerAuthorization(
  client: SuiGrpcClient,
  walletAddress: string,
): Promise<boolean> {
  assertConfiguredObjectId(TESTNET_PACKAGE_ID, "VITE_SUI_PACKAGE_ID");
  assertConfiguredObjectId(TESTNET_REPAIRER_CAP_ID, "VITE_SUI_REPAIRER_CAP_ID");

  try {
    const { object } = await client.core.getObject({
      objectId: TESTNET_REPAIRER_CAP_ID,
      include: { json: true },
    });

    assertObjectType(object.type, "RepairerCap", "Repairer capability");

    if (!object.json || typeof object.json !== "object") {
      throw new PassportDataError(
        "invalid-config",
        "The configured RepairerCap does not expose readable fields.",
      );
    }

    const fields = object.json as Record<string, unknown>;

    return (
      fields.active === true &&
      typeof fields.repairer === "string" &&
      fields.repairer.toLowerCase() === walletAddress.toLowerCase()
    );
  } catch (error) {
    throw classifyReadFailure(error, "the repairer capability");
  }
}

export async function checkRegistrarAuthorization(
  client: SuiGrpcClient,
  walletAddress: string,
): Promise<boolean> {
  assertConfiguredObjectId(TESTNET_PACKAGE_ID, "VITE_SUI_PACKAGE_ID");
  assertConfiguredObjectId(
    TESTNET_REGISTRAR_CAP_ID,
    "VITE_SUI_REGISTRAR_CAP_ID",
  );

  if (
    TESTNET_REGISTRAR_CAP_ID.toLowerCase() ===
    TESTNET_ADMIN_CAP_ID.toLowerCase()
  ) {
    throw new PassportDataError(
      "invalid-config",
      "The registrar capability ID matches the AdminCap ID. Configure an active RegistrarCap before enabling registration.",
    );
  }

  try {
    const { object } = await client.core.getObject({
      objectId: TESTNET_REGISTRAR_CAP_ID,
      include: { json: true },
    });

    assertObjectType(object.type, "RegistrarCap", "Registrar capability");

    if (!object.json || typeof object.json !== "object") {
      throw new PassportDataError(
        "invalid-config",
        "The configured RegistrarCap does not expose readable fields.",
      );
    }

    const fields = object.json as Record<string, unknown>;

    return (
      fields.active === true &&
      typeof fields.registrar === "string" &&
      fields.registrar.toLowerCase() === walletAddress.toLowerCase()
    );
  } catch (error) {
    throw classifyReadFailure(error, "the registrar capability");
  }
}
