import { useCurrentClient } from "@mysten/dapp-kit-react";
import { useQuery } from "@tanstack/react-query";
import { TESTNET_REGISTRAR_CAP_ID } from "../constants";
import { checkRegistrarAuthorization } from "../data/sui-passport";

export function useRegistrarAuthorization(walletAddress: string | null) {
  const client = useCurrentClient();

  return useQuery({
    queryKey: [
      "redevice",
      "registrar-authorization",
      TESTNET_REGISTRAR_CAP_ID,
      walletAddress,
    ],
    queryFn: () => checkRegistrarAuthorization(client, walletAddress!),
    enabled: Boolean(walletAddress),
    staleTime: 15_000,
  });
}
