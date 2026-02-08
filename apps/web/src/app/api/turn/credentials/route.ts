import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = request.headers.get("x-vercel-id") ?? crypto.randomUUID();

  console.info("[turn.credentials] request:start", {
    requestId,
    method: "GET",
    path: new URL(request.url).pathname
  });

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      console.warn("[turn.credentials] unauthorized", { requestId });
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const turnUrl = process.env.TURN_URL;
    const turnUsername = process.env.TURN_USERNAME;
    const turnPassword = process.env.TURN_PASSWORD;

    if (!turnUrl || !turnUsername || !turnPassword) {
      console.warn("[turn.credentials] missing-config", {
        requestId,
        hasTurnUrl: Boolean(turnUrl),
        hasTurnUsername: Boolean(turnUsername),
        hasTurnPassword: Boolean(turnPassword),
        userIdPrefix: user.id.slice(0, 8)
      });
      return Response.json(
        { error: "TURN server not configured" },
        { status: 503 }
      );
    }

    const iceServers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: turnUrl,
        username: turnUsername,
        credential: turnPassword
      }
    ];

    console.info("[turn.credentials] request:success", {
      requestId,
      userIdPrefix: user.id.slice(0, 8),
      iceServerCount: iceServers.length
    });

    return Response.json(iceServers, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    console.error("[turn.credentials] request:error", {
      requestId,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
