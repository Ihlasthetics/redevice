import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { describe, expect, it, vi } from "vitest";
import {
  checkRegistrarAuthorization,
  checkRepairerAuthorization,
} from "./sui-passport";

function mockClient(getObject: ReturnType<typeof vi.fn>) {
  return { core: { getObject } } as unknown as SuiGrpcClient;
}

describe("authorization reads", () => {
  it("does not convert an RPC failure into a permission denial", async () => {
    const client = mockClient(
      vi.fn().mockRejectedValue(new Error("connection unavailable")),
    );

    await expect(
      checkRepairerAuthorization(client, `0x${"1".repeat(64)}`),
    ).rejects.toMatchObject({ code: "rpc-unavailable" });
  });

  it("rejects a wrong-type capability as invalid configuration", async () => {
    const client = mockClient(
      vi.fn().mockResolvedValue({
        object: {
          type: `0x${"9".repeat(64)}::redevice::DevicePassport`,
          json: { active: true, repairer: `0x${"1".repeat(64)}` },
        },
      }),
    );

    await expect(
      checkRepairerAuthorization(client, `0x${"1".repeat(64)}`),
    ).rejects.toMatchObject({ code: "invalid-config" });
  });

  it("diagnoses the checked-in registrar/admin ID collision before RPC", async () => {
    const getObject = vi.fn();

    await expect(
      checkRegistrarAuthorization(mockClient(getObject), `0x${"1".repeat(64)}`),
    ).rejects.toMatchObject({ code: "invalid-config" });
    expect(getObject).not.toHaveBeenCalled();
  });
});
