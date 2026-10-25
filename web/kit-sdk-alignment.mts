import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const kitEntry = fileURLToPath(import.meta.resolve("smart-account-kit"));

// The kit uses Stellar SDK 16. Its generated bindings declare a broad peer
// range and otherwise resolve to the app's SDK 17. The passkey page must also
// build transactions with SDK 16 before handing them to the kit for signing.
export function alignKitBindingsSdk(): Plugin {
  return {
    name: "align-kit-bindings-stellar-sdk",
    enforce: "pre",
    async resolveId(source, importer) {
      if (!/^@stellar\/stellar-sdk(?:\/|$)/.test(source)) return;
      if (
        !importer?.includes("/smart-account-kit-bindings/") &&
        !importer?.endsWith("/src/PasskeySpike.tsx")
      )
        return;
      return this.resolve(source, kitEntry, { skipSelf: true });
    },
  };
}
