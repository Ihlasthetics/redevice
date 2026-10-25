import { createHmac, timingSafeEqual } from "node:crypto";

function testToken() {
  const token = process.env.PASSKEY_TEST_TOKEN;
  if (!token || token.length < 32)
    throw new Error("Passkey test access is not configured.");
  return token;
}

function equal(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function sessionValue() {
  return createHmac("sha256", testToken())
    .update("redevice-passkey-test-session-v1")
    .digest("hex");
}

export function testEnabled() {
  return (
    process.env.VERCEL_ENV === "preview" &&
    process.env.PASSKEY_TEST_ENABLED === "true"
  );
}

export function sameOrigin(request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

export function validTestToken(submitted) {
  return typeof submitted === "string" && equal(submitted, testToken());
}

export function sessionCookie() {
  return `__Host-passkey_test=${sessionValue()}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600`;
}

export function authenticated(request) {
  const value = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)__Host-passkey_test=([a-f0-9]{64})(?:;|$)/)?.[1];
  return !!value && equal(value, sessionValue());
}

export async function readLimitedJson(request, limit) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit)
    throw new Error("Request is too large.");
  const body = await request.text();
  if (Buffer.byteLength(body) > limit) throw new Error("Request is too large.");
  return JSON.parse(body);
}
