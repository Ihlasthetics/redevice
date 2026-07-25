import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SUI_NETWORK, TESTNET_PACKAGE_ID } from "./constants";

export const dAppKit = createDAppKit({
  enableBurnerWallet: import.meta.env.DEV,
  networks: [SUI_NETWORK],
  defaultNetwork: SUI_NETWORK,
  createClient(network) {
    return new SuiGrpcClient({
      network,
      baseUrl: "https://fullnode.testnet.sui.io:443",
      mvr: TESTNET_PACKAGE_ID
        ? {
            overrides: {
              packages: {
                "@local-pkg/redevice": TESTNET_PACKAGE_ID,
              },
            },
          }
        : {},
    });
  },
});

declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
