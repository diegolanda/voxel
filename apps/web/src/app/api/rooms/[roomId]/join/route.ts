import {
  JOIN_RATE_LIMIT_MAX_ATTEMPTS,
  JOIN_RATE_LIMIT_WINDOW_SECONDS,
  createJoinAttemptKey,
  getRequestIp,
  normalizeRoomPassword,
  verifyRoomPassword
} from "@voxel/supabase";
import { redirectTo } from "../../../../../lib/http";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient
} from "../../../../../lib/supabase/server";

interface RouteContext {
  params:
    | {
        roomId: string;
      }
    | Promise<{
        roomId: string;
      }>;
}

async function recordFailedJoin(
  adminClient: ReturnType<typeof createAdminSupabaseClient>,
  roomId: string,
  attemptKey: string,
  ipAddress: string
) {
  await adminClient.schema("app_private").from("join_attempts").insert({
    room_id: roomId,
    attempt_key: attemptKey,
    ip_address: ipAddress
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  const resolvedParams = await params;
  const roomId = resolvedParams.roomId;
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "").trim();
  const nextPath = String(formData.get("next") ?? `/app/rooms/${roomId}`);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectTo(request, "/login", {
      error: "Please sign in"
    });
  }

  let password: string;
  try {
    password = normalizeRoomPassword(String(formData.get("password") ?? ""));
  } catch (error) {
    return redirectTo(request, `/join/${roomId}`, {
      token,
      error: error instanceof Error ? error.message : "Invalid password input"
    });
  }

  const ipAddress = getRequestIp(new Headers(request.headers));
  const attemptKey = await createJoinAttemptKey(roomId, ipAddress);
  const adminClient = createAdminSupabaseClient();

  const windowStart = new Date(
    Date.now() - JOIN_RATE_LIMIT_WINDOW_SECONDS * 1000
  ).toISOString();

  const { count: attemptCount } = await adminClient
    .schema("app_private")
    .from("join_attempts")
    .select("id", { head: true, count: "exact" })
    .eq("room_id", roomId)
    .eq("attempt_key", attemptKey)
    .gte("created_at", windowStart);

  if ((attemptCount ?? 0) >= JOIN_RATE_LIMIT_MAX_ATTEMPTS) {
    return redirectTo(request, `/join/${roomId}`, {
      token,
      error: "Too many failed attempts. Please wait and try again."
    });
  }

  const { data: room } = await adminClient
    .from("rooms")
    .select("id, invite_token, password_hash, max_players")
    .eq("id", roomId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!room || room.invite_token !== token) {
    await recordFailedJoin(adminClient, roomId, attemptKey, ipAddress);
    return redirectTo(request, `/join/${roomId}`, {
      token,
      error: "Invite token is invalid"
    });
  }

  const passwordIsValid = await verifyRoomPassword(password, room.password_hash);
  if (!passwordIsValid) {
    await recordFailedJoin(adminClient, roomId, attemptKey, ipAddress);
    return redirectTo(request, `/join/${roomId}`, {
      token,
      error: "Incorrect password"
    });
  }

  const { data: existingMembership } = await adminClient
    .from("room_members")
    .select("user_id, role")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existingMembership) {
    const { count: memberCount } = await adminClient
      .from("room_members")
      .select("user_id", { head: true, count: "exact" })
      .eq("room_id", roomId);

    if ((memberCount ?? 0) >= room.max_players) {
      return redirectTo(request, `/join/${roomId}`, {
        token,
        error: "Room is full"
      });
    }

    const { error: insertError } = await adminClient
      .from("room_members")
      .insert({ room_id: roomId, role: "guest", user_id: user.id });

    if (insertError) {
      return redirectTo(request, `/join/${roomId}`, {
        token,
        error: insertError.message
      });
    }
  }

  return redirectTo(request, nextPath, {
    notice: "Joined room"
  });
}
