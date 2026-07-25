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

export const passportAdapter = {
  getPublicPassport(): PublicDevicePassport {
    return samplePassport;
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
