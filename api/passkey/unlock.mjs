import {
  readLimitedJson,
  sameOrigin,
  sessionCookie,
  testEnabled,
  validTestToken,
} from "../_passkey-auth.mjs";

export default {
  async fetch(request) {
    if (request.method !== "POST")
      return Response.json({ error: "Method refused." }, { status: 405 });
    if (!testEnabled())
      return Response.json({ error: "Test disabled." }, { status: 503 });
    if (!sameOrigin(request))
      return Response.json({ error: "Origin refused." }, { status: 403 });
    try {
      const { token } = await readLimitedJson(request, 4096);
      if (!validTestToken(token))
        return Response.json({ error: "Invalid test token." }, { status: 401 });
      return Response.json(
        { success: true },
        {
          headers: {
            "Set-Cookie": sessionCookie(),
            "Cache-Control": "no-store",
          },
        },
      );
    } catch {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }
  },
};
