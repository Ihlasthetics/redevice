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
  model: string;
  category: string;
  maskedSerial: string;
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

const samplePassport: PublicDevicePassport = {
  id: "RDP-2026-0148",
  manufacturer: "Apple",
  model: "MacBook Pro 14-inch",
  category: "Laptop computer",
  maskedSerial: "C02•••••92",
  condition: "Refurbished",
  coverageStart: {
    isoDate: "2026-07-25",
    displayDate: "25 July 2026",
  },
  verification: {
    label: "Repairer verified",
    explanation:
      "Records added to this passport must be signed by a repairer authorized by the ReDevice contract.",
  },
  repairHistory: [
    {
      id: "service-002",
      serviceDate: {
        isoDate: "2026-07-25",
        displayDate: "25 July 2026",
      },
      repairType: "Battery replacement",
      summary:
        "Battery replaced and the device completed a post-service inspection.",
      repairer: "Lisbon Device Lab",
      conditionChange: {
        previous: "Inspected",
        next: "Refurbished",
      },
      batteryHealth: 96,
      evidence: {
        label: "Public evidence",
        url: null,
      },
      transaction: {
        label: "Sui Explorer",
        url: null,
      },
      repairerDetails: {
        workOrderReference: "WO-2026-0725-018",
        laborMinutes: 54,
        diagnostics: [
          "Battery capacity was below the service threshold.",
          "Charging, thermal, and sleep checks passed after replacement.",
        ],
        partsUsed: [
          {
            name: "Replacement battery assembly",
            reference: "BAT-MBP14-DEMO",
            quantity: 1,
          },
        ],
        technicianNotes:
          "Battery was replaced, the enclosure was resealed, and post-service diagnostics completed without a reported fault.",
      },
    },
    {
      id: "service-001",
      serviceDate: {
        isoDate: "2026-07-21",
        displayDate: "21 July 2026",
      },
      repairType: "Initial inspection",
      summary:
        "Core functions, enclosure, display, ports, and charging were inspected.",
      repairer: "Lisbon Device Lab",
      conditionChange: {
        previous: "In service",
        next: "Inspected",
      },
      evidence: {
        label: "Public evidence",
        url: null,
      },
      transaction: {
        label: "Sui Explorer",
        url: null,
      },
      repairerDetails: {
        workOrderReference: "WO-2026-0721-006",
        laborMinutes: 35,
        diagnostics: [
          "Display, keyboard, ports, speakers, camera, and charging were checked.",
          "Battery health required follow-up service.",
        ],
        partsUsed: [],
        technicianNotes:
          "Initial intake inspection completed. The device was held for a battery replacement before refurbishment.",
      },
    },
  ],
};

const sampleRepairWorkspace: RepairWorkspaceConfig = {
  selectedDeviceId: samplePassport.id,
  repairTypes: [
    "Battery replacement",
    "Display replacement",
    "Keyboard replacement",
    "Port repair",
    "Initial inspection",
    "Other service",
  ],
  lifecycleConditions: ["Inspected", "Refurbished", "In service", "Retired"],
  defaultRepairType: "Battery replacement",
  defaultNextCondition: "Refurbished",
  privacyWarning:
    "Evidence will be public. Never upload full serial numbers, invoices, customer names, addresses, private documents, recovery phrases, or private keys.",
  integrationNotice:
    "This form prepares the frontend only. It cannot upload to Walrus, request a wallet signature, or submit a Sui transaction until the contract integration is connected.",
};

const sampleTransactionStates: TransactionStatusDefinition[] = [
  {
    id: "ready",
    shortLabel: "Ready",
    label: "Ready to submit",
    description:
      "The service draft is complete and the connected wallet is authorized.",
    nextStep:
      "The real integration will start the public evidence upload after the repairer confirms.",
    tone: "neutral",
  },
  {
    id: "uploading",
    shortLabel: "Uploading",
    label: "Uploading public evidence",
    description:
      "The selected non-sensitive file is being stored on Walrus before the repair record is submitted.",
    nextStep:
      "Keep this page open. A wallet signature will be requested after the upload succeeds.",
    tone: "pending",
  },
  {
    id: "awaiting-signature",
    shortLabel: "Signature",
    label: "Awaiting wallet signature",
    description:
      "The repair record is prepared and waiting for the connected wallet to approve it.",
    nextStep:
      "Review the device, repair details, lifecycle change, and network in the wallet.",
    tone: "pending",
  },
  {
    id: "submitting",
    shortLabel: "Submitting",
    label: "Submitting to Sui testnet",
    description:
      "The signed repair record has been sent to Sui and is waiting for confirmation.",
    nextStep:
      "Do not submit again. The passport will refresh after the transaction is confirmed.",
    tone: "pending",
  },
  {
    id: "confirmed",
    shortLabel: "Confirmed",
    label: "Repair record confirmed",
    description:
      "Sui confirmed the authorized repairer's update and the passport can now show the new record.",
    nextStep:
      "A real confirmation will include a Sui Explorer link and the public Walrus evidence link.",
    tone: "success",
  },
  {
    id: "rejected",
    shortLabel: "Rejected",
    label: "Wallet lacks permission",
    description:
      "The Move contract rejected this update because the connected wallet is not an authorized repairer.",
    nextStep:
      "No repair record was added. Connect an authorized wallet or ask the prototype administrator to grant permission.",
    tone: "danger",
  },
];

export const passportAdapter = {
  getPublicPassport(): PublicDevicePassport {
    return samplePassport;
  },

  getPublicPassportById(deviceId: string): PublicDevicePassport | undefined {
    return deviceId.toUpperCase() === samplePassport.id
      ? samplePassport
      : undefined;
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
    // A QR payload may be a URL or a plain device ID instead of JSON.
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
      .find((segment) => /^RDP-[A-Z0-9-]+$/i.test(segment));

    if (pathId) {
      return pathId;
    }
  } catch {
    // The payload may be a ReDevice URI or a plain device ID.
  }

  const reDeviceUri = value.match(/^redevice:(?:passport:)?(.+)$/i);
  const candidate = reDeviceUri?.[1] ?? value;

  return /^RDP-[A-Z0-9-]{4,64}$/i.test(candidate) ? candidate.trim() : null;
}

export const qrPassportAdapter = {
  getSamplePayload(): string {
    return samplePassport.id;
  },

  resolve(payload: string): PassportQrResolution {
    const deviceId = readDeviceIdFromQrPayload(payload);

    if (!deviceId) {
      return {
        status: "invalid",
        message:
          "This QR code does not contain a supported ReDevice passport ID.",
      };
    }

    const passport = passportAdapter.getPublicPassportById(deviceId);

    if (!passport) {
      return {
        status: "not-found",
        deviceId,
        message:
          "The QR code is valid, but this frontend sample does not have data for that device yet.",
      };
    }

    return {
      status: "matched",
      deviceId: passport.id,
      passport,
    };
  },
};

export const repairWorkspaceAdapter = {
  getConfig(): RepairWorkspaceConfig {
    return sampleRepairWorkspace;
  },

  getAuthorization(walletAddress: string | null): RepairerAuthorization {
    if (!walletAddress) {
      return {
        status: "disconnected",
        label: "Wallet not connected",
        explanation:
          "Connect a Sui testnet wallet before checking repair permission.",
      };
    }

    return {
      status: "unchecked",
      label: "Authorization check pending",
      explanation:
        "The wallet is connected, but the published Move package is not integrated yet, so repair permission has not been checked onchain.",
    };
  },
};

export const transactionStatusAdapter = {
  getAll(): TransactionStatusDefinition[] {
    return sampleTransactionStates;
  },

  getById(status: TransactionStatus): TransactionStatusDefinition {
    const state = sampleTransactionStates.find((item) => item.id === status);

    if (!state) {
      throw new Error(`Unknown transaction status: ${status}`);
    }

    return state;
  },
};
