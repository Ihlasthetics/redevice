import { describe, expect, it } from "vitest";
import { buildPassportUrl } from "./passport-url";

const passportId = `0x${"a".repeat(64)}`;

describe("passport QR URLs", () => {
  it("warns when the QR target is localhost-only", () => {
    const result = buildPassportUrl({
      passportId,
      currentHref: "http://localhost:5173/app",
    });

    expect(result.isLocalOnly).toBe(true);
    expect(result.url).toContain(`passport=${passportId}`);
  });

  it("uses a configured HTTPS public origin", () => {
    const result = buildPassportUrl({
      passportId,
      currentHref: "http://localhost:5173/app",
      configuredOrigin: "https://passport.example",
    });

    expect(result.url).toBe(
      `https://passport.example/app?passport=${passportId}#passport-title`,
    );
    expect(result.isLocalOnly).toBe(false);
  });

  it("rejects an unsafe configured origin and falls back safely", () => {
    const result = buildPassportUrl({
      passportId,
      currentHref: "https://safe.example/app",
      configuredOrigin: "javascript:alert(1)",
    });

    expect(result.url).toMatch(/^https:\/\/safe\.example/);
    expect(result.configurationWarning).toMatch(/must use HTTPS/);
  });
});
