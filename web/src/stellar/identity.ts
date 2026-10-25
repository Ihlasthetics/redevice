const COMMITMENT_DOMAIN = "redevice:serial:v1";
const MAX_DEVICE_ID = 18_446_744_073_709_551_615n;

export type SerialIdentity = {
  manufacturerNamespace: string;
  productNamespace: string;
  serial: string;
};

function normalizeNamespace(value: string, field: string): string {
  const normalized = value.normalize("NFKC").trim().toLowerCase();

  if (
    normalized.length > 64 ||
    !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(normalized)
  ) {
    throw new Error(`${field} must be a 1–64 character ASCII namespace.`);
  }

  return normalized;
}

function normalizeSerial(value: string): string {
  const normalized = value.normalize("NFKC").trim().toUpperCase();

  if (
    normalized.length > 128 ||
    !/^[A-Z0-9]+(?:[._/-][A-Z0-9]+)*$/.test(normalized)
  ) {
    throw new Error("Serial must be 1–128 ASCII characters without spaces.");
  }

  return normalized;
}

export function normalizeSerialIdentity(
  identity: SerialIdentity,
): SerialIdentity {
  return {
    manufacturerNamespace: normalizeNamespace(
      identity.manufacturerNamespace,
      "Manufacturer namespace",
    ),
    productNamespace: normalizeNamespace(
      identity.productNamespace,
      "Product namespace",
    ),
    serial: normalizeSerial(identity.serial),
  };
}

export function maskSerial(serial: string): string {
  const normalized = normalizeSerial(serial);
  return normalized.length >= 6 ? `***${normalized.slice(-3)}` : "****";
}

export async function createSerialCommitment(
  identity: SerialIdentity,
): Promise<string> {
  const normalized = normalizeSerialIdentity(identity);
  const preimage = new TextEncoder().encode(
    `${COMMITMENT_DOMAIN}\0${normalized.manufacturerNamespace}\0${normalized.productNamespace}\0${normalized.serial}`,
  );
  const digest = await globalThis.crypto.subtle.digest("SHA-256", preimage);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function parseStellarDeviceId(value: string): string {
  if (
    value.length > 20 ||
    !/^[1-9][0-9]*$/.test(value) ||
    BigInt(value) > MAX_DEVICE_ID
  ) {
    throw new Error(
      "Device ID must be a positive decimal u64 without leading zeroes.",
    );
  }

  return value;
}
