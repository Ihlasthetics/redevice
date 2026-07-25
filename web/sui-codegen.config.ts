import type { SuiCodegenConfig } from "@mysten/codegen";

const config: SuiCodegenConfig = {
  output: "./src/contracts",
  packages: [
    {
      package: "@local-pkg/redevice",
      path: "../move/redevice",
    },
  ],
};

export default config;
