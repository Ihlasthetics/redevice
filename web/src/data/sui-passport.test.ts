import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { afterEach, describe, expect, it, vi } from "vitest";

const PACKAGE_ID = `0x${"a".repeat(64)}`;
const REPAIRER_CAP_ID = `0x${"b".repeat(64)}`;
const REGISTRAR_CAP_ID = `0x${"c".repeat(64)}`;
const ADMIN_CAP_ID = `0x${"d".repeat(64)}`;
const WALLET_ADDRESS = `0x${"1".repeat(64)}`;

type TestConfig = {
  packageId?: string;
  repairerCapId?: string;
  registrarCapId?: string;
  adminCapId?: string;
};

function mockClient(getObject: ReturnType<typeof vi.fn>) {
  return { core: { getObject } } as unknown as SuiGrpcClient;
}

async function loadAuthorizationModule(config: TestConfig = {}) {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.stubEnv("VITE_SUI_PACKAGE_ID", config.packageId ?? PACKAGE_ID);
  vi.stubEnv(
    "VITE_SUI_REPAIRER_CAP_ID",
    config.repairerCapId ?? REPAIRER_CAP_ID,
  );
  vi.stubEnv(
    "VITE_SUI_REGISTRAR_CAP_ID",
    config.registrarCapId ?? REGISTRAR_CAP_ID,
  );
  vi.stubEnv("VITE_SUI_ADMIN_CAP_ID", config.adminCapId ?? ADMIN_CAP_ID);

  return import("./sui-passport");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("authorization reads", () => {
  it("diagnoses an explicit registrar/admin ID collision before RPC", async () => {
    const { checkRegistrarAuthorization } = await loadAuthorizationModule({
      registrarCapId: ADMIN_CAP_ID,
    });
    const getObject = vi.fn();

    await expect(
      checkRegistrarAuthorization(mockClient(getObject), WALLET_ADDRESS),
    ).rejects.toMatchObject({ code: "invalid-config" });
    expect(getObject).not.toHaveBeenCalled();
  });

  it("authorizes an active compatible RegistrarCap assigned to the caller", async () => {
    const { checkRegistrarAuthorization } = await loadAuthorizationModule();
    const getObject = vi.fn().mockResolvedValue({
      object: {
        type: `${PACKAGE_ID}::redevice::RegistrarCap`,
        json: { active: true, registrar: WALLET_ADDRESS },
      },
    });

    await expect(
      checkRegistrarAuthorization(mockClient(getObject), WALLET_ADDRESS),
    ).resolves.toBe(true);
    expect(getObject).toHaveBeenCalledWith({
      objectId: REGISTRAR_CAP_ID,
      include: { json: true },
    });
  });

  it.each([
    ["another wallet", true, `0x${"2".repeat(64)}`],
    ["an inactive capability", false, WALLET_ADDRESS],
  ])(
    "rejects %s without reporting a read failure",
    async (_case, active, owner) => {
      const { checkRegistrarAuthorization } = await loadAuthorizationModule();
      const client = mockClient(
        vi.fn().mockResolvedValue({
          object: {
            type: `${PACKAGE_ID}::redevice::RegistrarCap`,
            json: { active, registrar: owner },
          },
        }),
      );

      await expect(
        checkRegistrarAuthorization(client, WALLET_ADDRESS),
      ).resolves.toBe(false);
    },
  );

  it("does not convert an RPC failure into a permission denial", async () => {
    const { checkRepairerAuthorization } = await loadAuthorizationModule();
    const client = mockClient(
      vi.fn().mockRejectedValue(new Error("connection unavailable")),
    );

    await expect(
      checkRepairerAuthorization(client, WALLET_ADDRESS),
    ).rejects.toMatchObject({ code: "rpc-unavailable" });
  });

  it("rejects a wrong-type capability as invalid configuration", async () => {
    const { checkRepairerAuthorization } = await loadAuthorizationModule();
    const client = mockClient(
      vi.fn().mockResolvedValue({
        object: {
          type: `${PACKAGE_ID}::redevice::DevicePassport`,
          json: { active: true, repairer: WALLET_ADDRESS },
        },
      }),
    );

    await expect(
      checkRepairerAuthorization(client, WALLET_ADDRESS),
    ).rejects.toMatchObject({ code: "invalid-config" });
  });
});
