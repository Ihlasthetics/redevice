import assert from "node:assert/strict";
import { test } from "node:test";

process.env.VERCEL_ENV = "preview";
process.env.PASSKEY_TEST_ENABLED = "true";
process.env.PASSKEY_TEST_TOKEN = "local-test-token-12345678901234567890";
process.env.CHANNELS_API_KEY = "unused-local-test-key";
process.env.PASSKEY_REDEVICE_CONTRACT_ID =
  "CDSP64KAEVFZ5QU3U2AMTNFWWF3CHEXRCFBSXWDESF6QSR3SHU2CWZCT";

const [{ default: unlock }, { default: sponsor }] = await Promise.all([
  import("../api/passkey/unlock.mjs"),
  import("../api/passkey.mjs"),
]);
const origin = "https://test.vercel.app";
const post = (path, body, headers = {}) =>
  new Request(`${origin}${path}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

test("Vercel preview sponsor requires a same-origin test session", async () => {
  const anonymous = await sponsor.fetch(post("/api/passkey", {}));
  assert.equal(anonymous.status, 401);

  const crossOrigin = await unlock.fetch(
    post(
      "/api/passkey/unlock",
      { token: process.env.PASSKEY_TEST_TOKEN },
      {
        origin: "https://attacker.example",
      },
    ),
  );
  assert.equal(crossOrigin.status, 403);

  const wrongToken = await unlock.fetch(
    post("/api/passkey/unlock", { token: "wrong" }),
  );
  assert.equal(wrongToken.status, 401);

  const unlocked = await unlock.fetch(
    post("/api/passkey/unlock", { token: process.env.PASSKEY_TEST_TOKEN }),
  );
  assert.equal(unlocked.status, 200);
  const cookie = unlocked.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);

  const invalidCall = await sponsor.fetch(
    post("/api/passkey", {}, { cookie: cookie.split(";")[0] }),
  );
  assert.equal(invalidCall.status, 400);
});

test("sponsor is disabled outside the explicitly enabled preview", async () => {
  process.env.VERCEL_ENV = "production";
  try {
    const result = await sponsor.fetch(post("/api/passkey", {}));
    assert.equal(result.status, 503);
  } finally {
    process.env.VERCEL_ENV = "preview";
  }
});
