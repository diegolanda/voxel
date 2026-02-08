import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const turnUrl = process.env.TURN_URL;
  const turnUsername = process.env.TURN_USERNAME;
  const turnPassword = process.env.TURN_PASSWORD;

  if (!turnUrl || !turnUsername || !turnPassword) {
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

  return Response.json(iceServers, {
    headers: { "Cache-Control": "no-store" }
  });
}
