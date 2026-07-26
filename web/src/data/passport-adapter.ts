import { TESTNET_PASSPORT_ID, transactionExplorerUrl } from "../constants";

export type LifecycleCondition =
  "Inspected" | "Refurbished" | "In service" | "Retired";

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
  | "uploading"
  | "awaiting-signature"
  | "submitting"
  | "confirmed"
  | "rejected";

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
  attested_at_ms: string | number;
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
  "Inspected",
  "Refurbished",
  "In service",
  "Retired",
];

export function lifecycleConditionFromCode(
  value: string | number,
): LifecycleCondition {
  const index = Number(value);
  return lifecycleConditions[index] ?? "Inspected";
}

export function lifecycleConditionToCode(value: LifecycleCondition): number {
  const index = lifecycleConditions.indexOf(value);
  return index < 0 ? 0 : index;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The Sui object does not contain readable Move fields.");
  }

  return value as Record<string, unknown>;
}

function requiredString(fields: Record<string, unknown>, key: string): string {
  const value = fields[key];

  if (typeof value !== "string") {
    throw new Error(`The passport is missing its ${key} field.`);
  }

  return value;
}

function optionalString(
  fields: Record<string, unknown>,
  key: string,
): string | null {
  const value = fields[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function formatAddress(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function formatDate(timestamp: string | number) {
  const date = new Date(Number(timestamp));

  if (Number.isNaN(date.getTime())) {
    throw new Error("The passport contains an invalid timestamp.");
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

function inferBrand(model: string) {
  return /macbook|iphone|ipad|apple/i.test(model) ? "Apple" : "Unknown brand";
}

function maskSerial(serial: string) {
  return serial.replace(/\*+/g, (hidden) => "•".repeat(hidden.length));
}

function evidenceLink(reference: string): RepairRecordLink {
  if (/^https?:\/\//i.test(reference)) {
    return { label: "Public evidence", url: reference };
  }

  return {
    label: reference
      ? `Evidence ref · ${reference.slice(0, 28)}${reference.length > 28 ? "…" : ""}`
      : "No evidence reference",
    url: null,
  };
}

function isOnchainRepair(value: unknown): value is OnchainRepair {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const repair = value as Partial<OnchainRepair>;
  return (
    typeof repair.repair_type === "string" &&
    typeof repair.notes === "string" &&
    typeof repair.repairer === "string" &&
    typeof repair.evidence_blob_id === "string" &&
    repair.serviced_at_ms !== undefined &&
    repair.previous_status !== undefined &&
    repair.new_status !== undefined
  );
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
    label: "Testnet record",
    explanation:
      "This fallback mirrors the published ReDevice Testnet passport while the live RPC reconnects.",
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
        previous: "Inspected",
        next: "Refurbished",
      },
      batteryHealth: 96,
      evidence: {
        label: "Evidence ref · battery-diagnostic-001",
        url: null,
      },
      transaction: {
        label: "View on SuiVision",
        url: transactionExplorerUrl(
          "CLe1iBPyaCqHwrwbJnPFwDHiD1CU3AfuAZpZ2WggpyeZ",
        ),
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
    "The repair details are written to Sui Testnet. Walrus upload is not connected in this build, so a selected file creates only a public demo evidence reference; the file itself is not uploaded.",
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
    id: "uploading",
    shortLabel: "Evidence",
    label: "Preparing evidence reference",
    description:
      "The frontend is preparing a demo evidence reference. No file bytes are uploaded.",
    nextStep: "The wallet signature request comes next.",
    tone: "pending",
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
    id: "confirmed",
    shortLabel: "Confirmed",
    label: "Repair record confirmed",
    description:
      "Sui confirmed the authorized update and the live passport has been refreshed.",
    nextStep: "Open the transaction in SuiVision or scan the device again.",
    tone: "success",
  },
  {
    id: "rejected",
    shortLabel: "Rejected",
    label: "Transaction not submitted",
    description:
      "The wallet lacks permission, the signature was rejected, or Sui returned an error.",
    nextStep:
      "Read the message below, then connect the authorized Testnet wallet and retry.",
    tone: "danger",
  },
];

export const passportAdapter = {
  getPublicPassport(): PublicDevicePassport {
    return fallbackPassport;
  },

  fromSuiObject(object: SuiObjectJson): PublicDevicePassport {
    const fields = asRecord(object.json);
    const model = requiredString(fields, "model");
    const manufacturer = requiredString(fields, "manufacturer");
    const repairs = Array.isArray(fields.repairs)
      ? fields.repairs.filter(isOnchainRepair)
      : [];
    const lastRepairIndex = repairs.length - 1;

    return {
      id: object.objectId,
      manufacturer: formatAddress(manufacturer),
      deviceName: optionalString(fields, "device_name") ?? model,
      brand: optionalString(fields, "brand") ?? inferBrand(model),
      model,
      category: inferCategory(model),
      maskedSerial: maskSerial(requiredString(fields, "masked_serial")),
      serialHash: optionalString(fields, "serial_hash"),
      condition: lifecycleConditionFromCode(
        String(fields.lifecycle_status ?? 0),
      ),
      coverageStart: formatDate(
        String(fields.history_started_at_ms ?? Date.now()),
      ),
      verification: {
        label:
          Number(fields.verification_level ?? 0) >= 2
            ? "Contract verified"
            : "On-chain record",
        explanation:
          "This passport and its service history were read directly from the published ReDevice package on Sui Testnet.",
      },
      repairHistory: repairs
        .map((repair, index): RepairRecord => {
          const transactionDigest =
            index === lastRepairIndex ? object.previousTransaction : undefined;

          return {
            id: `repair-${index + 1}`,
            serviceDate: formatDate(repair.serviced_at_ms),
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

  try {
    const parsed = JSON.parse(value) as unknown;

    if (typeof parsed === "object" && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      const candidate =
        record.deviceId ?? record.passportId ?? record.device_id ?? record.id;

      if (typeof candidate === "string") {
        return candidate.trim();
      }
    }
  } catch {
    // A QR payload may be a URL or a plain object ID instead of JSON.
  }

  try {
    const url = new URL(value);
    const queryId =
      url.searchParams.get("device") ??
      url.searchParams.get("deviceId") ??
      url.searchParams.get("passport");

    if (queryId) {
      return queryId.trim();
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

  const reDeviceUri = value.match(/^redevice:(?:passport:)?(.+)$/i);
  const candidate = reDeviceUri?.[1] ?? value;

  return /^0x[a-f0-9]{64}$/i.test(candidate) ? candidate.trim() : null;
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
  ): RepairerAuthorization {
    if (!walletAddress) {
      return {
        status: "disconnected",
        label: "Wallet not connected",
        explanation:
          "Connect the Sui Testnet wallet that owns the repairer authorization.",
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
