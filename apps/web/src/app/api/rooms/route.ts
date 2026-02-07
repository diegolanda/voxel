import { MAX_WORLDS_PER_ACCOUNT } from "@voxel/domain";
import {
  hashRoomPassword,
  hasReachedWorldCap,
  normalizeRoomCreateInput
} from "@voxel/supabase";
import { redirectTo } from "../../../lib/http";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectTo(request, "/login", {
      error: "Please sign in"
    });
  }

  const formData = await request.formData();

  let input: ReturnType<typeof normalizeRoomCreateInput>;
  try {
    input = normalizeRoomCreateInput({
      name: String(formData.get("name") ?? ""),
      theme: String(formData.get("theme") ?? ""),
      seed: String(formData.get("seed") ?? ""),
      password: String(formData.get("password") ?? "")
    });
  } catch (error) {
    return redirectTo(request, "/app", {
      error: error instanceof Error ? error.message : "Invalid room input"
    });
  }

  const { count: existingCount } = await supabase
    .from("rooms")
    .select("id", { head: true, count: "exact" })
    .eq("host_id", user.id)
    .is("deleted_at", null);

  if (hasReachedWorldCap(existingCount ?? 0)) {
    return redirectTo(request, "/app", {
      error: `You can own at most ${MAX_WORLDS_PER_ACCOUNT} worlds`
    });
  }

  const passwordHash = await hashRoomPassword(input.password);

  // Use RPC function to create room with host membership atomically
  // This bypasses RLS issues with the trigger
  const { data: roomId, error } = await supabase
    .rpc("create_room_with_host", {
      p_name: input.name,
      p_theme: input.theme,
      p_seed: input.seed,
      p_password_hash: passwordHash,
      p_max_players: 5
    });

  if (error || !roomId) {
    // Log detailed error information for RLS issues
    console.error("[Room Creation Error]", {
      userId: user.id,
      roomName: input.name,
      error: {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      }
    });

    const message = error?.message?.includes("world_cap_reached")
      ? `You can own at most ${MAX_WORLDS_PER_ACCOUNT} worlds`
      : error?.message ?? "Could not create room";

    return redirectTo(request, "/app", {
      error: message
    });
  }

  console.log("[Room Created Successfully]", {
    roomId: roomId,
    hostId: user.id,
    roomName: input.name
  });

  return redirectTo(request, `/app/rooms/${roomId}`, {
    notice: "Room created"
  });
}
