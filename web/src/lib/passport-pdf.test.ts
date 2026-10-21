import { decode } from "fast-png";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { createPassportPdf } from "./passport-pdf";

describe("passport PDF generation", () => {
  it("creates an openable PDF from a QR that decodes to the intended target", async () => {
    const qrTarget = `https://passport.example/?passport=0x${"a".repeat(64)}`;
    const qrDataUrl = await QRCode.toDataURL(qrTarget, {
      width: 720,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    const pngBytes = Uint8Array.from(
      atob(qrDataUrl.split(",")[1] ?? ""),
      (character) => character.charCodeAt(0),
    );
    const decodedPng = decode(pngBytes);
    const decodedQr = jsQR(
      new Uint8ClampedArray(decodedPng.data),
      decodedPng.width,
      decodedPng.height,
    );

    expect(decodedPng.channels).toBe(4);
    expect(decodedQr?.data).toBe(qrTarget);

    const pdf = await createPassportPdf({
      qrDataUrl,
      qrTarget,
      passportId: `0x${"a".repeat(64)}`,
      deviceName: "Verification laptop",
      brand: "ReDevice",
      model: "Test model",
      maskedSerial: "ABC•••1234",
      registeredDate: "15 October 2026",
      explorerUrl: "https://testnet.suivision.xyz/object/test",
    });
    const bytes = new Uint8Array(pdf.output("arraybuffer"));

    expect(new TextDecoder().decode(bytes.slice(0, 8))).toMatch(/^%PDF-/);
    expect(bytes.byteLength).toBeGreaterThan(10_000);
  });
});
