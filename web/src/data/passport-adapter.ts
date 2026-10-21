import {
  TESTNET_PACKAGE_ID,
  TESTNET_PASSPORT_ID,
  transactionExplorerUrl,
} from "../constants";

export type PassportDataErrorCode =
  "invalid-config" | "missing-or-incompatible" | "rpc-unavailable";

export class PassportDataError extends Error {
  readonly code: PassportDataErrorCode;

  constructor(code: PassportDataErrorCode, message: string) {
    super(message);
    this.name = "PassportDataError";
    this.code = code;
  }
}

export type LifecycleCondition =
  "Used" | "Repaired" | "Refurbished" | "Parts only";

export type VerificationLevel = {
  label: string;
  explanation: string;
};

export type RepairRecordLink = {
  label: string;
  url: string | null;
};

export type RepairerRecordDetails = {
  workOrderReference: string;
  laborMinutes: number;
  diagnostics: string[];
  partsUsed: {
    name: string;
    reference: string;
    quantity: number;
  }[];
  technicianNotes: string;
};

export type RepairRecord = {
  id: string;
  serviceDate: {
    isoDate: string;
    displayDate: string;
  };
  attestedAt?: {
    isoDate: string;
    displayDate: string;
  };
  repairType: string;
  summary: string;
  repairer: string;
  conditionChange: {
    previous: LifecycleCondition;
    next: LifecycleCondition;
  };
  batteryHealth?: number;
  evidence: RepairRecordLink;
  transaction: RepairRecordLink;
  repairerDetails?: RepairerRecordDetails;
};

export type PublicDevicePassport = {
  id: string;
  manufacturer: string;
  deviceName: string;
  brand: string;
  model: string;
  category: string;
  maskedSerial: string;
  serialHash: string | null;
  condition: LifecycleCondition;
  coverageStart: {
    isoDate: string;
    displayDate: string;
  };
  verification: VerificationLevel;
  repairHistory: RepairRecord[];
  source:
    | {
        kind: "live";
        network: "Sui Testnet";
        objectType: string;
        fetchedAt: string;
      }
    | {
        kind: "fixture";
        label: "Demo data — not a live blockchain record.";
      };
};

export type RepairerAuthorization =
  | {
      status: "disconnected";
      label: "Wallet not connected";
      explanation: string;
    }
  | {
      status: "unchecked";
      label: "Authorization check pending";
      explanation: string;
    }
  | {
      status: "authorized";
      label: "Authorized repairer";
      explanation: string;
    }
  | {
      status: "unauthorized";
      label: "Wallet lacks permission";
      explanation: string;
    }
  | {
      status: "invalid-config";
      label: "Authorization configuration error";
      explanation: string;
    }
  | {
      status: "unavailable";
      label: "Authorization check unavailable";
      explanation: string;
    };

export type RepairWorkspaceConfig = {
  selectedDeviceId: string;
  repairTypes: string[];
  lifecycleConditions: LifecycleCondition[];
  defaultRepairType: string;
  defaultNextCondition: LifecycleCondition;
  privacyWarning: string;
  integrationNotice: string;
};

export type TransactionStatus =
  | "ready"
  | "awaiting-signature"
  | "submitting"
  | "confirmed-refreshing"
  | "confirmed"
  | "confirmed-refresh-failed"
  | "cancelled"
  | "failed"
  | "unknown";

export type TransactionStatusDefinition = {
  id: TransactionStatus;
  shortLabel: string;
  label: string;
  description: string;
  nextStep: string;
  tone: "neutral" | "pending" | "success" | "danger";
};

export type PassportQrResolution =
  | {
      status: "matched";
      deviceId: string;
      passport: PublicDevicePassport;
    }
  | {
      status: "invalid";
      message: string;
    }
  | {
      status: "not-found";
      deviceId: string;
      message: string;
    };

type SuiObjectJson = {
  objectId: string;
  type: string;
  previousTransaction?: string | null;
  json?: unknown;
};

type OnchainRepair = {
  attested_at_ms?: string | number;
  battery_health: string | number;
  evidence_blob_id: string;
  new_status: string | number;
  notes: string;
  previous_status: string | number;
  repair_type: string;
  repairer: string;
  serviced_at_ms: string | number;
};

const lifecycleConditions: LifecycleCondition[] = [
  "Used",
  "Repaired",
  "Refurbished",
  "Parts only",
];

export function lifecycleConditionFromCode(
  value: string | number,
): LifecycleCondition {
  const index = unsignedInteger(value, "lifecycle status", 3);
  return lifecycleConditions[index];
}

export function lifecycleConditionToCode(value: LifecycleCondition): number {
  const index = lifecycleConditions.indexOf(value);
  if (index < 0) {
    throw new Error("The selected lifecycle condition is not supported.");
  }
  return index;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PassportDataError(
      "missing-or-incompatible",
      "The Sui object does not contain readable Move fields.",
    );
  }

  return value as Record<string, unknown>;
}

function requiredString(fields: Record<string, unknown>, key: string): string {
  const value = fields[key];

  if (typeof value !== "string" || !value.trim()) {
    throw new PassportDataError(
      "missing-or-incompatible",
      `The passport is missing a valid ${key} field.`,
    );
  }

  return value;
}

function requiredAddress(fields: Record<string, unknown>, key: string): string {
  const address = requiredString(fields, key);
  if (!/^0x[0-9a-f]{1,64}$/i.test(address)) {
    throw new PassportDataError(
      "missing-or-incompatible",
      `The passport contains an invalid ${key} address.`,
    );
  }
  return address;
}

function formatAddress(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function unsignedInteger(value: unknown, label: string, maximum?: number) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : NaN;

  if (
    !Number.isSafeInteger(numericValue) ||
    numericValue < 0 ||
    (maximum !== undefined && numericValue > maximum)
  ) {
    throw new PassportDataError(
      "missing-or-incompatible",
      `The passport contains an invalid ${label}.`,
    );
  }

  return numericValue;
}

function formatDate(timestamp: unknown) {
  const date = new Date(unsignedInteger(timestamp, "timestamp"));

  if (Number.isNaN(date.getTime())) {
    throw new PassportDataError(
      "missing-or-incompatible",
      "The passport contains an invalid timestamp.",
    );
  }

  return {
    isoDate: date.toISOString().slice(0, 10),
    displayDate: new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date),
  };
}

function inferCategory(model: string) {
  const normalized = model.toLowerCase();

  if (normalized.includes("macbook") || normalized.includes("laptop")) {
    return "Laptop computer";
  }

  if (normalized.includes("phone") || normalized.includes("iphone")) {
    return "Mobile phone";
  }

  return "Electronic device";
}

function maskSerial(serial: string) {
  return serial.replace(/\*+/g, (hidden) => "•".repeat(hidden.length));
}

function evidenceLink(reference: string): RepairRecordLink {
  if (/^demo-evidence:/i.test(reference)) {
    return {
      label: "Historical demo placeholder · not retrievable",
      url: null,
    };
  }

  if (reference) {
    try {
      const url = new URL(reference);

      if (url.protocol === "https:" || url.protocol === "http:") {
        return { label: "Public evidence", url: url.toString() };
      }
    } catch {
      // Historical values may be opaque references rather than URLs.
    }
  }

  return {
    label: reference
      ? `Evidence ref · ${reference.slice(0, 28)}${reference.length > 28 ? "…" : ""}`
      : "No evidence reference",
    url: null,
  };
}

function parseOnchainRepair(value: unknown): OnchainRepair {
  const fields = asRecord(value);
  const notes = fields.notes;
  const evidence = fields.evidence_blob_id;

  if (typeof notes !== "string" || typeof evidence !== "string") {
    throw new PassportDataError(
      "missing-or-incompatible",
      "A repair record has malformed public notes or evidence.",
    );
  }

  const repair = {
    repair_type: requiredString(fields, "repair_type"),
    notes,
    repairer: requiredAddress(fields, "repairer"),
    evidence_blob_id: evidence,
    serviced_at_ms: unsignedInteger(fields.serviced_at_ms, "service timestamp"),
    attested_at_ms:
      fields.attested_at_ms === undefined
        ? undefined
        : unsignedInteger(fields.attested_at_ms, "attestation timestamp"),
    previous_status: unsignedInteger(
      fields.previous_status,
      "previous status",
      3,
    ),
    new_status: unsignedInteger(fields.new_status, "new status", 3),
    battery_health: unsignedInteger(
      fields.battery_health,
      "battery health",
      100,
    ),
  };

  formatDate(repair.serviced_at_ms);
  if (repair.attested_at_ms !== undefined) {
    formatDate(repair.attested_at_ms);
  }
  return repair;
}

const fallbackPassport: PublicDevicePassport = {
  id: TESTNET_PASSPORT_ID,
  manufacturer: "0xd7fd25…5f215",
  deviceName: "Demo MacBook",
  brand: "Apple",
  model: "MacBook Pro 14",
  category: "Laptop computer",
  maskedSerial: "C02•••••92",
  serialHash: null,
  condition: "Refurbished",
  coverageStart: {
    isoDate: "2026-07-25",
    displayDate: "25 July 2026",
  },
  verification: {
    label: "Demo fixture",
    explanation:
      "This static fixture demonstrates the interface and is not evidence of a blockchain read.",
  },
  source: {
    kind: "fixture",
    label: "Demo data — not a live blockchain record.",
  },
  repairHistory: [
    {
      id: "repair-1",
      serviceDate: {
        isoDate: "2026-07-25",
        displayDate: "25 July 2026",
      },
      repairType: "Battery Replacement",
      summary: "Battery replaced and full diagnostic completed",
      repairer: "ReDevice Lisbon Service · 0xd7fd25…5f215",
      conditionChange: {
        previous: "Used",
        next: "Refurbished",
      },
      batteryHealth: 96,
      evidence: {
        label: "Historical demo placeholder · not retrievable",
        url: null,
      },
      transaction: {
        label: "Demo transaction placeholder",
        url: null,
      },
    },
  ],
};

const repairWorkspace: RepairWorkspaceConfig = {
  selectedDeviceId: TESTNET_PASSPORT_ID,
  repairTypes: [
    "Battery Replacement",
    "Display Replacement",
    "Keyboard Replacement",
    "Port Repair",
    "Initial Inspection",
    "Other Service",
  ],
  lifecycleConditions,
  defaultRepairType: "Battery Replacement",
  defaultNextCondition: "Refurbished",
  privacyWarning:
    "This transaction is public. Never include full serial numbers, invoices, customer names, addresses, private documents, recovery phrases, or private keys.",
  integrationNotice:
    "Evidence upload is unavailable in this build. Repair submissions record an explicit empty evidence value; no file or filename is uploaded or published.",
};

const transactionStates: TransactionStatusDefinition[] = [
  {
    id: "ready",
    shortLabel: "Ready",
    label: "Ready to prepare",
    description:
      "Review every public field and connect the authorized Sui Testnet wallet.",
    nextStep:
      "When authorization is confirmed, the submit button becomes active.",
    tone: "neutral",
  },
  {
    id: "awaiting-signature",
    shortLabel: "Signature",
    label: "Approve in your wallet",
    description:
      "Your Sui wallet is waiting for approval of the Testnet transaction.",
    nextStep:
      "Check the package, device, and public repair details before signing.",
    tone: "pending",
  },
  {
    id: "submitting",
    shortLabel: "Submitting",
    label: "Submitting to Sui Testnet",
    description:
      "The signed repair record is waiting for final network confirmation.",
    nextStep: "Keep this page open and do not submit the same record twice.",
    tone: "pending",
  },
  {
    id: "confirmed-refreshing",
    shortLabel: "Refreshing",
    label: "Transaction confirmed; refreshing passport",
    description:
      "Sui confirmed the repair transaction. The updated passport readback is still in progress.",
    nextStep:
      "Keep this page open; the confirmed transaction link is already available.",
    tone: "success",
  },
  {
    id: "confirmed",
    shortLabel: "Confirmed",
    label: "Repair record confirmed",
    description:
      "Sui confirmed the authorized update and the live passport has been refreshed.",
    nextStep: "Open the transaction in SuiVision or scan the device again.",
    tone: "success",
  },
  {
    id: "confirmed-refresh-failed",
    shortLabel: "Refresh needed",
    label: "Transaction confirmed; refresh unavailable",
    description:
      "Sui confirmed the repair transaction, but the updated passport could not be read back.",
    nextStep:
      "Keep the transaction link and retry only the passport refresh when the RPC is available.",
    tone: "success",
  },
  {
    id: "cancelled",
    shortLabel: "Cancelled",
    label: "Signature cancelled",
    description:
      "The wallet request was cancelled, so the interface makes no success claim.",
    nextStep:
      "Review the transaction details and submit again only if you still intend to publish them.",
    tone: "neutral",
  },
  {
    id: "failed",
    shortLabel: "Failed",
    label: "Ledger execution failed",
    description:
      "Sui returned a confirmed execution failure. No successful repair update was recorded.",
    nextStep:
      "Open the transaction when a digest is available and review the error.",
    tone: "danger",
  },
  {
    id: "unknown",
    shortLabel: "Unknown",
    label: "Transaction status unknown",
    description:
      "The wallet or network stopped responding before the application received a definitive result.",
    nextStep:
      "Check the wallet activity and explorer before attempting another submission.",
    tone: "danger",
  },
];

export const passportAdapter = {
  getPublicPassport(): PublicDevicePassport {
    return fallbackPassport;
  },

  fromSuiObject(object: SuiObjectJson): PublicDevicePassport {
    const expectedType = `${TESTNET_PACKAGE_ID}::redevice::DevicePassport`;

    if (
      typeof object.type !== "string" ||
      object.type.toLowerCase() !== expectedType.toLowerCase()
    ) {
      throw new PassportDataError(
        "missing-or-incompatible",
        `The selected object is ${object.type || "an unknown type"}, not the configured ${expectedType}. Check the Testnet package and passport IDs.`,
      );
    }

    const fields = asRecord(object.json);
    const model = requiredString(fields, "model");
    const manufacturer = requiredAddress(fields, "manufacturer");
    if (!Array.isArray(fields.repairs)) {
      throw new PassportDataError(
        "missing-or-incompatible",
        "The passport is missing a valid repairs field.",
      );
    }
    const repairs = fields.repairs.map(parseOnchainRepair);
    const lastRepairIndex = repairs.length - 1;
    const verificationLevel = unsignedInteger(
      fields.verification_level,
      "verification level",
      255,
    );
    if (verificationLevel !== 1 && verificationLevel !== 2) {
      throw new PassportDataError(
        "missing-or-incompatible",
        "The passport contains an unknown verification level.",
      );
    }

    return {
      id: object.objectId,
      manufacturer: formatAddress(manufacturer),
      deviceName: requiredString(fields, "device_name"),
      brand: requiredString(fields, "brand"),
      model,
      category: inferCategory(model),
      maskedSerial: maskSerial(requiredString(fields, "masked_serial")),
      serialHash: requiredAddress(fields, "serial_hash"),
      condition: lifecycleConditionFromCode(
        fields.lifecycle_status as string | number,
      ),
      coverageStart: formatDate(fields.history_started_at_ms),
      verification: {
        label:
          verificationLevel === 2 ? "Contract verified" : "On-chain record",
        explanation:
          "This passport and its service history were read directly from the published ReDevice package on Sui Testnet.",
      },
      source: {
        kind: "live",
        network: "Sui Testnet",
        objectType: object.type,
        fetchedAt: new Date().toISOString(),
      },
      repairHistory: repairs
        .map((repair, index): RepairRecord => {
          const transactionDigest =
            index === lastRepairIndex ? object.previousTransaction : undefined;

          return {
            id: `repair-${index + 1}`,
            serviceDate: formatDate(repair.serviced_at_ms),
            ...(repair.attested_at_ms === undefined
              ? {}
              : { attestedAt: formatDate(repair.attested_at_ms) }),
            repairType: repair.repair_type,
            summary: repair.notes,
            repairer: `ReDevice repairer · ${formatAddress(repair.repairer)}`,
            conditionChange: {
              previous: lifecycleConditionFromCode(repair.previous_status),
              next: lifecycleConditionFromCode(repair.new_status),
            },
            batteryHealth:
              Number(repair.battery_health) > 0
                ? Number(repair.battery_health)
                : undefined,
            evidence: evidenceLink(repair.evidence_blob_id),
            transaction: transactionDigest
              ? {
                  label: "View on SuiVision",
                  url: transactionExplorerUrl(transactionDigest),
                }
              : {
                  label: "Earlier transaction",
                  url: null,
                },
          };
        })
        .reverse(),
    };
  },
};

function readDeviceIdFromQrPayload(payload: string): string | null {
  const value = payload.trim();

  if (!value || value.length > 2_048) {
    return null;
  }

  const normalizeObjectId = (candidate: unknown) =>
    typeof candidate === "string" && /^0x[a-f0-9]{64}$/i.test(candidate.trim())
      ? candidate.trim()
      : null;

  try {
    const parsed = JSON.parse(value) as unknown;

    if (typeof parsed === "object" && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      const candidate =
        record.deviceId ?? record.passportId ?? record.device_id ?? record.id;

      const objectId = normalizeObjectId(candidate);

      if (objectId) {
        return objectId;
      }
    }
  } catch {
    // A QR payload may be a URL or a plain object ID instead of JSON.
  }

  const reDeviceUri = value.match(/^redevice:(?:passport:)?(.+)$/i);
  if (reDeviceUri) {
    return normalizeObjectId(reDeviceUri[1]);
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    const queryId =
      url.searchParams.get("device") ??
      url.searchParams.get("deviceId") ??
      url.searchParams.get("passport");

    const queryObjectId = normalizeObjectId(queryId);

    if (queryObjectId) {
      return queryObjectId;
    }

    const pathId = url.pathname
      .split("/")
      .filter(Boolean)
      .reverse()
      .find((segment) => /^0x[a-f0-9]{64}$/i.test(segment));

    if (pathId) {
      return pathId;
    }
  } catch {
    // The payload may be a ReDevice URI or a plain Sui object ID.
  }

  return normalizeObjectId(value);
}

export const qrPassportAdapter = {
  getSamplePayload(): string {
    return TESTNET_PASSPORT_ID;
  },

  readDeviceId(payload: string): string | null {
    return readDeviceIdFromQrPayload(payload);
  },

  resolve(
    payload: string,
    livePassport: PublicDevicePassport,
  ): PassportQrResolution {
    const deviceId = readDeviceIdFromQrPayload(payload);

    if (!deviceId) {
      return {
        status: "invalid",
        message:
          "This QR code does not contain a supported Sui passport object ID.",
      };
    }

    if (deviceId.toLowerCase() !== livePassport.id.toLowerCase()) {
      return {
        status: "not-found",
        deviceId,
        message:
          "The QR code is valid, but this demo is configured for a different Testnet passport.",
      };
    }

    return {
      status: "matched",
      deviceId: livePassport.id,
      passport: livePassport,
    };
  },
};

export const repairWorkspaceAdapter = {
  getConfig(): RepairWorkspaceConfig {
    return repairWorkspace;
  },

  getAuthorization(
    walletAddress: string | null,
    authorizationResult?: boolean,
    authorizationError?: unknown,
  ): RepairerAuthorization {
    if (!walletAddress) {
      return {
        status: "disconnected",
        label: "Wallet not connected",
        explanation:
          "Connect the Sui Testnet wallet that owns the repairer authorization.",
      };
    }

    if (authorizationError instanceof PassportDataError) {
      return authorizationError.code === "invalid-config"
        ? {
            status: "invalid-config",
            label: "Authorization configuration error",
            explanation: authorizationError.message,
          }
        : {
            status: "unavailable",
            label: "Authorization check unavailable",
            explanation:
              "Sui Testnet could not be reached. Permission has not been denied; signing remains disabled until the check succeeds.",
          };
    }

    if (authorizationError) {
      return {
        status: "unavailable",
        label: "Authorization check unavailable",
        explanation:
          "Sui Testnet could not be reached. Permission has not been denied; signing remains disabled until the check succeeds.",
      };
    }

    if (authorizationResult === undefined) {
      return {
        status: "unchecked",
        label: "Authorization check pending",
        explanation: "Reading the shared RepairerCap from Sui Testnet.",
      };
    }

    if (authorizationResult) {
      return {
        status: "authorized",
        label: "Authorized repairer",
        explanation:
          "The active on-chain RepairerCap matches this wallet address.",
      };
    }

    return {
      status: "unauthorized",
      label: "Wallet lacks permission",
      explanation: "This wallet does not match the active Testnet RepairerCap.",
    };
  },
};

export const transactionStatusAdapter = {
  getAll(): TransactionStatusDefinition[] {
    return transactionStates;
  },

  getById(status: TransactionStatus): TransactionStatusDefinition {
    const state = transactionStates.find((item) => item.id === status);

    if (!state) {
      throw new Error(`Unknown transaction status: ${status}`);
    }

    return state;
  },
};
