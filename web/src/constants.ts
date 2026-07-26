export const SUI_NETWORK = "testnet" as const;

export const TESTNET_PACKAGE_ID =
  import.meta.env.VITE_SUI_PACKAGE_ID ||
  "0xd960ddb62abcbf29d916639debf1ddb9e2e110140b7f4e897f1922f64c5dcf60";

export const TESTNET_PASSPORT_ID =
  import.meta.env.VITE_SUI_PASSPORT_ID ||
  "0xc1e9a7e28afc26bccf67cae9ea29807d7961bc3d1f922f9aa8f7156c03c46666";

export const TESTNET_REPAIRER_CAP_ID =
  import.meta.env.VITE_SUI_REPAIRER_CAP_ID ||
  "0xab7b404781516f3bd0cda69f0cff2672a52f7a9abdb67fa112e180256a602b96";

export const TESTNET_REGISTRAR_CAP_ID =
  import.meta.env.VITE_SUI_REGISTRAR_CAP_ID ||
  "0x04ff58fb952f681e9a8db94d2f6d754b0a663cc1507a277c701cc18ef6ddb952";

export const TESTNET_ADMIN_CAP_ID =
  import.meta.env.VITE_SUI_ADMIN_CAP_ID ||
  "0x04ff58fb952f681e9a8db94d2f6d754b0a663cc1507a277c701cc18ef6ddb952";

export const TESTNET_REGISTRY_ID =
  import.meta.env.VITE_SUI_REGISTRY_ID ||
  "0x63db08a5932edad48c36bdfe33b7a447276ccfd8b4fb55ef6157b596f10eeb5a";

export const TESTNET_REPAIRER_ADDRESS =
  import.meta.env.VITE_SUI_REPAIRER_ADDRESS ||
  "0xaf954872292bb1bf7afc5d746b29b7ec1a1f95edc4a38cd22f2c5f6504c24d6f";

export const TESTNET_ISSUER_ADDRESS =
  import.meta.env.VITE_SUI_ISSUER_ADDRESS ||
  "0xaf954872292bb1bf7afc5d746b29b7ec1a1f95edc4a38cd22f2c5f6504c24d6f";

const SUIVISION_TESTNET_URL = "https://testnet.suivision.xyz";

export function objectExplorerUrl(objectId: string) {
  return `${SUIVISION_TESTNET_URL}/object/${objectId}`;
}

export function transactionExplorerUrl(digest: string) {
  return `${SUIVISION_TESTNET_URL}/txblock/${digest}`;
}
