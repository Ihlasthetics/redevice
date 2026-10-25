import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSerialCommitment,
  normalizeSerialIdentity,
  parseStellarDeviceId,
} from "./identity";

beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => vi.unstubAllGlobals());

describe("Stellar serial commitment v1", () => {
  it("matches the published Lenovo vector after normalization", async () => {
    const identity = {
      manufacturerNamespace: " Lenovo ",
      productNamespace: "THINKPAD-T14",
      serial: " pf-123/ab9 ",
    };

    expect(normalizeSerialIdentity(identity)).toEqual({
      manufacturerNamespace: "lenovo",
      productNamespace: "thinkpad-t14",
      serial: "PF-123/AB9",
    });
    expect(await createSerialCommitment(identity)).toBe(
      "34d758d5c722dbb8650d8fc1cc19fefa53b84fe12e9e0bfe9bea99b6f7018d58",
    );
  });

  it("matches the independent Fairphone vector", async () => {
    expect(
      await createSerialCommitment({
        manufacturerNamespace: "fairphone",
        productNamespace: "fairphone-5",
        serial: "ABC123456",
      }),
    ).toBe("37c8357d35f2e1858436b455e305e987661d040e63f1dbf28bd095e6fce43785");
  });

  it("keeps punctuation and product namespace significant", async () => {
    const identity = {
      manufacturerNamespace: "lenovo",
      productNamespace: "thinkpad-t14",
      serial: "PF-123/AB9",
    };
    const original = await createSerialCommitment(identity);

    expect(
      await createSerialCommitment({ ...identity, serial: "PF123/AB9" }),
    ).not.toBe(original);
    expect(
      await createSerialCommitment({
        ...identity,
        productNamespace: "thinkpad-t14s",
      }),
    ).not.toBe(original);
  });

  it.each([
    { manufacturerNamespace: "", productNamespace: "model", serial: "ABC123" },
    {
      manufacturerNamespace: "brand name",
      productNamespace: "model",
      serial: "ABC123",
    },
    {
      manufacturerNamespace: "brand",
      productNamespace: "model",
      serial: "ABC 123",
    },
    {
      manufacturerNamespace: "brand",
      productNamespace: "model",
      serial: "ABC?123",
    },
    { manufacturerNamespace: "brand", productNamespace: "model", serial: "" },
  ])("rejects ambiguous or unsupported inputs: %j", (identity) => {
    expect(() => normalizeSerialIdentity(identity)).toThrow();
  });
});

describe("Stellar device ID", () => {
  it("keeps large valid IDs exact", () => {
    expect(parseStellarDeviceId("18446744073709551615")).toBe(
      "18446744073709551615",
    );
  });

  it.each([
    "0",
    "01",
    "-1",
    "1.5",
    "18446744073709551616",
    "0x1234",
    " 1 ",
    "9".repeat(100),
  ])("rejects invalid or hex object ID %s", (value) => {
    expect(() => parseStellarDeviceId(value)).toThrow();
  });
});
