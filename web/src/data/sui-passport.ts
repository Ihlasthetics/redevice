import type { SuiGrpcClient } from "@mysten/sui/grpc";
import {
  TESTNET_PASSPORT_ID,
  TESTNET_REGISTRAR_CAP_ID,
  TESTNET_REPAIRER_CAP_ID,
} from "../constants";
import { passportAdapter, type PublicDevicePassport } from "./passport-adapter";

export async function loadTestnetPassport(
  client: SuiGrpcClient,
  objectId = TESTNET_PASSPORT_ID,
): Promise<PublicDevicePassport> {
  const { object } = await client.core.getObject({
    objectId,
    include: {
      json: true,
      previousTransaction: true,
    },
  });

  return passportAdapter.fromSuiObject(object);
}

export async function checkRepairerAuthorization(
  client: SuiGrpcClient,
  walletAddress: string,
): Promise<boolean> {
  const { object } = await client.core.getObject({
    objectId: TESTNET_REPAIRER_CAP_ID,
    include: { json: true },
  });

  if (!object.json || typeof object.json !== "object") {
    return false;
  }

  const fields = object.json as Record<string, unknown>;

  return (
    fields.active === true &&
    typeof fields.repairer === "string" &&
    fields.repairer.toLowerCase() === walletAddress.toLowerCase()
  );
}

export async function checkRegistrarAuthorization(
  client: SuiGrpcClient,
  walletAddress: string,
): Promise<boolean> {
  const { object } = await client.core.getObject({
    objectId: TESTNET_REGISTRAR_CAP_ID,
    include: { json: true },
  });

  if (!object.json || typeof object.json !== "object") {
    return false;
  }

  const fields = object.json as Record<string, unknown>;

  return (
    fields.active === true &&
    typeof fields.registrar === "string" &&
    fields.registrar.toLowerCase() === walletAddress.toLowerCase()
  );
}
