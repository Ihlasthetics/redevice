import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { ChannelsClient } from "@openzeppelin/relayer-plugin-channels";
import { validateSpikePayload } from "../api/_passkey-policy.mjs";

const keyFile = process.env.CHANNELS_KEY_FILE;
const contractId = process.env.PASSKEY_REDEVICE_CONTRACT_ID;
if (!keyFile || !contractId)
  throw new Error("Set CHANNELS_KEY_FILE and PASSKEY_REDEVICE_CONTRACT_ID.");

const { apiKey } = JSON.parse(await readFile(keyFile, "utf8"));
if (!apiKey) throw new Error("Channels API key is missing.");
const channels = new ChannelsClient({
  baseUrl: "https://channels.openzeppelin.com/testnet",
  apiKey,
});
const policy = {
  accountWasmHash:
    "1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a",
  redeviceContractId: contractId,
  repairerAddress: process.env.PASSKEY_REPAIRER_ADDRESS ?? "",
  allowCreation: process.env.PASSKEY_ALLOW_CREATE === "true",
};
let creationUsed = false;
let repairUsed = false;

const origin = "http://localhost:5173";
createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Headers", "content-type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Content-Type", "application/json");
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }
  if (request.method !== "POST" || request.url !== "/") {
    response.writeHead(404).end(JSON.stringify({ success: false }));
    return;
  }
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 48_000) throw new Error("Sponsor payload is too large.");
      chunks.push(chunk);
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const action = validateSpikePayload(payload, policy);
    if (
      (action === "create" && creationUsed) ||
      (action === "repair" && repairUsed)
    )
      throw new Error("This local spike already sponsored that action.");
    if (action === "create") creationUsed = true;
    else repairUsed = true;
    const result = await channels.submitSorobanTransaction({
      func: payload.func,
      auth: payload.auth,
    });
    response.writeHead(200).end(
      JSON.stringify({
        success: true,
        transactionId: result.transactionId,
        hash: result.hash,
        status: result.status,
      }),
    );
  } catch (error) {
    response.writeHead(400).end(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Sponsorship failed.",
      }),
    );
  }
}).listen(8787, "127.0.0.1", () => {
  process.stdout.write("Passkey spike sponsor listening on 127.0.0.1:8787\n");
});
