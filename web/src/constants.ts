export const SUI_NETWORK = "testnet" as const;

// Added after the Move package is published to Sui testnet.
export const TESTNET_PACKAGE_ID =
  import.meta.env.VITE_SUI_PACKAGE_ID || undefined;
