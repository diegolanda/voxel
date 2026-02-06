import { normalizeAvatarColor, normalizeDisplayName } from "@voxel/supabase";
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

  let displayName: string;
  let avatarColor: string;

  try {
    displayName = normalizeDisplayName(String(formData.get("displayName") ?? ""));
    avatarColor = normalizeAvatarColor(String(formData.get("avatarColor") ?? ""));
  } catch (error) {
    return redirectTo(request, "/app", {
      error: error instanceof Error ? error.message : "Invalid profile input"
    });
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      display_name: displayName,
      avatar_color: avatarColor
    },
    {
      onConflict: "user_id"
    }
  );

  if (error) {
    return redirectTo(request, "/app", {
      error: error.message
    });
  }

  return redirectTo(request, "/app", {
    notice: "Profile updated"
  });
}
