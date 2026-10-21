import { describe, expect, it } from "vitest";
import { TESTNET_PACKAGE_ID, TESTNET_PASSPORT_ID } from "../constants";
import {
  PassportDataError,
  lifecycleConditionFromCode,
  lifecycleConditionToCode,
  passportAdapter,
  qrPassportAdapter,
} from "./passport-adapter";

const validObject = {
  objectId: TESTNET_PASSPORT_ID,
  type: `${TESTNET_PACKAGE_ID}::redevice::DevicePassport`,
  previousTransaction: "digest-1",
  json: {
    device_name: "Test laptop",
    manufacturer: `0x${"1".repeat(64)}`,
    brand: "Test brand",
    model: "Test laptop",
    masked_serial: "ABC***1234",
    serial_hash: `0x${"2".repeat(64)}`,
    verification_level: 2,
    lifecycle_status: 1,
    history_started_at_ms: 1_800_000_000_000,
    repairs: [],
  },
};

const validRepair = {
  attested_at_ms: 1_800_086_400_000,
  battery_health: 0,
  evidence_blob_id: "",
  new_status: 1,
  notes: "Checked",
  previous_status: 0,
  repair_type: "Inspection",
  repairer: `0x${"3".repeat(64)}`,
  serviced_at_ms: 1_800_000_000_000,
};

describe("passport provenance", () => {
  it("uses the Move contract's lifecycle codes for every condition", () => {
    const conditions = [
      "Used",
      "Repaired",
      "Refurbished",
      "Parts only",
    ] as const;

    conditions.forEach((condition, code) => {
      expect(lifecycleConditionFromCode(code)).toBe(condition);
      expect(lifecycleConditionToCode(condition)).toBe(code);
    });
    expect(() => lifecycleConditionToCode("Unknown" as never)).toThrow(
      /not supported/i,
    );
  });

  it("keeps the sample explicitly marked as a non-live fixture", () => {
    const passport = passportAdapter.getPublicPassport();

    expect(passport.source).toEqual({
      kind: "fixture",
      label: "Demo data — not a live blockchain record.",
    });
    expect(passport.verification.label).toBe("Demo fixture");
  });

  it("accepts a compatible configured DevicePassport as live", () => {
    const passport = passportAdapter.fromSuiObject(validObject);

    expect(passport.source.kind).toBe("live");
    expect(passport.verification.label).toBe("Contract verified");
  });

  it("rejects objects from another package or type", () => {
    expect(() =>
      passportAdapter.fromSuiObject({
        ...validObject,
        type: `0x${"9".repeat(64)}::redevice::DevicePassport`,
      }),
    ).toThrow(PassportDataError);
  });

  it("does not render unsafe evidence protocols as links", () => {
    const passport = passportAdapter.fromSuiObject({
      ...validObject,
      json: {
        ...validObject.json,
        repairs: [
          {
            attested_at_ms: 1_800_000_000_000,
            battery_health: 90,
            evidence_blob_id: "javascript:alert(1)",
            new_status: 1,
            notes: "Checked",
            previous_status: 0,
            repair_type: "Inspection",
            repairer: `0x${"3".repeat(64)}`,
            serviced_at_ms: 1_800_000_000_000,
          },
        ],
      },
    });

    expect(passport.repairHistory[0]?.evidence.url).toBeNull();
  });

  it("keeps the ledger attestation distinct from the claimed service date", () => {
    const passport = passportAdapter.fromSuiObject({
      ...validObject,
      json: {
        ...validObject.json,
        repairs: [
          {
            attested_at_ms: 1_800_086_400_000,
            battery_health: 0,
            evidence_blob_id: "",
            new_status: 1,
            notes: "Checked",
            previous_status: 0,
            repair_type: "Inspection",
            repairer: `0x${"3".repeat(64)}`,
            serviced_at_ms: 1_800_000_000_000,
          },
        ],
      },
    });

    expect(passport.repairHistory[0]?.serviceDate.isoDate).toBe("2027-01-15");
    expect(passport.repairHistory[0]?.attestedAt?.isoDate).toBe("2027-01-16");
  });

  it("does not fabricate an attestation date for a legacy repair", () => {
    const passport = passportAdapter.fromSuiObject({
      ...validObject,
      json: {
        ...validObject.json,
        repairs: [
          {
            battery_health: 0,
            evidence_blob_id: "",
            new_status: 1,
            notes: "Checked",
            previous_status: 0,
            repair_type: "Inspection",
            repairer: `0x${"3".repeat(64)}`,
            serviced_at_ms: 1_800_000_000_000,
          },
        ],
      },
    });

    expect(passport.repairHistory[0]?.attestedAt).toBeUndefined();
    expect(passport.repairHistory[0]).not.toHaveProperty("attestedAt");
  });

  it.each([
    ["missing coverage", { history_started_at_ms: undefined }],
    ["invalid coverage", { history_started_at_ms: "not-a-date" }],
    ["unknown lifecycle", { lifecycle_status: 9 }],
    ["missing repairs", { repairs: undefined }],
    ["invalid verification", { verification_level: "unknown" }],
    ["unknown verification", { verification_level: 3 }],
    ["missing verification", { verification_level: 0 }],
    ["invalid manufacturer address", { manufacturer: "not-an-address" }],
  ])("rejects %s instead of fabricating live data", (_label, changedFields) => {
    expect(() =>
      passportAdapter.fromSuiObject({
        ...validObject,
        json: { ...validObject.json, ...changedFields },
      }),
    ).toThrow(PassportDataError);
  });

  it.each([
    ["missing notes", { notes: undefined }],
    ["invalid service date", { serviced_at_ms: "invalid" }],
    ["invalid attestation date", { attested_at_ms: -1 }],
    ["unknown condition", { new_status: 7 }],
    ["invalid battery value", { battery_health: 101 }],
    ["invalid repairer address", { repairer: "not-an-address" }],
  ])(
    "rejects a repair with %s instead of dropping it",
    (_label, changedFields) => {
      expect(() =>
        passportAdapter.fromSuiObject({
          ...validObject,
          json: {
            ...validObject.json,
            repairs: [{ ...validRepair, ...changedFields }],
          },
        }),
      ).toThrow(PassportDataError);
    },
  );

  it("keeps the contract's zero battery sentinel absent", () => {
    const passport = passportAdapter.fromSuiObject({
      ...validObject,
      json: { ...validObject.json, repairs: [validRepair] },
    });

    expect(passport.repairHistory[0]?.batteryHealth).toBeUndefined();
  });
});

describe("QR parsing", () => {
  it("accepts existing Sui IDs and HTTPS passport routes", () => {
    expect(qrPassportAdapter.readDeviceId(TESTNET_PASSPORT_ID)).toBe(
      TESTNET_PASSPORT_ID,
    );
    expect(
      qrPassportAdapter.readDeviceId(
        `https://example.test/?passport=${TESTNET_PASSPORT_ID}`,
      ),
    ).toBe(TESTNET_PASSPORT_ID);
  });

  it("rejects unsafe URL protocols even when they contain a passport ID", () => {
    expect(
      qrPassportAdapter.readDeviceId(
        `javascript:alert(1)?passport=${TESTNET_PASSPORT_ID}`,
      ),
    ).toBeNull();
  });
});
