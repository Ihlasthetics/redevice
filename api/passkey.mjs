// The package root also loads its server plugin, whose CommonJS Stellar import
// fails in Vercel's function runtime. This endpoint only needs the HTTP client.
import { ChannelsClient } from "@openzeppelin/relayer-plugin-channels/dist/client/channels-client.js";
import { Address, Networks, rpc, xdr } from "@stellar/stellar-sdk";
import {
  authenticated,
  readLimitedJson,
  sameOrigin,
  testEnabled,
} from "./_passkey-auth.mjs";
import { validateSpikePayload } from "./_passkey-policy.mjs";

export default {
  async fetch(request) {
    if (request.method !== "POST")
      return Response.json(
        { success: false, error: "Method refused." },
        { status: 405 },
      );
    if (!testEnabled())
      return Response.json(
        { success: false, error: "Test disabled." },
        { status: 503 },
      );
    if (!sameOrigin(request) || !authenticated(request))
      return Response.json(
        { success: false, error: "Test access required." },
        { status: 401 },
      );
    const apiKey = process.env.CHANNELS_API_KEY;
    const contractId = process.env.PASSKEY_REDEVICE_CONTRACT_ID;
    if (!apiKey || !contractId)
      return Response.json(
        { success: false, error: "Sponsor is not configured." },
        { status: 503 },
      );
    try {
      const payload = await readLimitedJson(request, 48_000);
      const action = validateSpikePayload(payload, {
        accountWasmHash:
          "1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a",
        redeviceContractId: contractId,
        repairerAddress: "",
        allowApprovedRepairer: true,
        allowCreation: process.env.PASSKEY_ALLOW_CREATE === "true",
      });
      if (action === "repair") {
        const entry = xdr.SorobanAuthorizationEntry.fromXdr(
          payload.auth[0],
          "base64",
        );
        const credential =
          entry.credentials.type === "sorobanCredentialsAddress"
            ? entry.credentials.address
            : entry.credentials.addressV2;
        const repairer = Address.fromScAddress(credential.address).toString();
        const role = await new rpc.Server(
          "https://soroban-testnet.stellar.org",
        ).queryContract(
          contractId,
          "has_role",
          {
            role: { tag: "Repairer" },
            account: repairer,
          },
          Networks.TESTNET,
        );
        if (!role.isReadCall || role.result !== true)
          throw new Error(
            "This passkey account does not have Repairer access.",
          );
      }
      const channels = new ChannelsClient({
        baseUrl: "https://channels.openzeppelin.com/testnet",
        apiKey,
      });
      const result = await channels.submitSorobanTransaction({
        func: payload.func,
        auth: payload.auth,
      });
      return Response.json({
        success: true,
        transactionId: result.transactionId,
        hash: result.hash,
        status: result.status,
      });
    } catch (error) {
      return Response.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Sponsorship failed.",
        },
        { status: 400 },
      );
    }
  },
};
