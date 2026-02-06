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

export async function POST(request: Request, { params }: RouteContext) {
  const resolvedParams = await params;
  const roomId = resolvedParams.roomId;
  const formData = await request.formData();
  const targetUserId = String(formData.get("targetUserId") ?? "").trim();
  const nextPath = String(formData.get("next") ?? `/app/rooms/${roomId}`);

  if (!targetUserId) {
    return redirectTo(request, nextPath, {
      error: "Target user is required"
    });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectTo(request, "/login", {
      error: "Please sign in"
    });
  }

  if (targetUserId === user.id) {
    return redirectTo(request, nextPath, {
      error: "Host cannot kick themselves"
    });
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id, host_id")
    .eq("id", roomId)
    .maybeSingle();

  if (!room || room.host_id !== user.id) {
    return redirectTo(request, nextPath, {
      error: "Only the host can kick members"
    });
  }

  const adminClient = createAdminSupabaseClient();
  const { error } = await adminClient
    .from("room_members")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", targetUserId)
    .eq("role", "guest");

  if (error) {
    return redirectTo(request, nextPath, {
      error: error.message
    });
  }

  return redirectTo(request, nextPath, {
    notice: "Member removed"
  });
}
