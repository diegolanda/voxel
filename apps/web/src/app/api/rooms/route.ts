import { MAX_WORLDS_PER_ACCOUNT } from "@voxel/domain";
import {
  createInviteToken,
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
  const inviteToken = createInviteToken();

  const { data, error } = await supabase
    .from("rooms")
    .insert({
      host_id: user.id,
      invite_token: inviteToken,
      max_players: 5,
      name: input.name,
      password_hash: passwordHash,
      seed: input.seed,
      theme: input.theme
    })
    .select("id")
    .single();

  if (error || !data) {
    const message = error?.message?.includes("world_cap_reached")
      ? `You can own at most ${MAX_WORLDS_PER_ACCOUNT} worlds`
      : error?.message ?? "Could not create room";

    return redirectTo(request, "/app", {
      error: message
    });
  }

  return redirectTo(request, `/app/rooms/${data.id}`, {
    notice: "Room created"
  });
}
