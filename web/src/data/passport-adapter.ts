export type LifecycleCondition =
  "Inspected" | "Refurbished" | "In service" | "Retired";

export type VerificationLevel = {
  label: string;
  explanation: string;
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
};

export const passportAdapter = {
  getPublicPassport(): PublicDevicePassport {
    return samplePassport;
  },
};
