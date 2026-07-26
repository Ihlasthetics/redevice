import { useCurrentClient } from "@mysten/dapp-kit-react";
import { useQuery } from "@tanstack/react-query";
import { TESTNET_REPAIRER_CAP_ID } from "../constants";
import { checkRepairerAuthorization } from "../data/sui-passport";

export function useRepairerAuthorization(walletAddress: string | null) {
  const client = useCurrentClient();

  return useQuery({
    queryKey: [
      "redevice",
      "repairer-authorization",
      TESTNET_REPAIRER_CAP_ID,
      walletAddress,
    ],
    queryFn: () => checkRepairerAuthorization(client, walletAddress!),
    enabled: Boolean(walletAddress),
    staleTime: 15_000,
  });
}
