import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "../../../lib/auth";
import type { MvpTheme } from "@voxel/domain";
import { isMvpTheme } from "@voxel/domain";
import { GameSession } from "./GameSession";

interface PlayPageProps {
  params:
    | { roomId: string }
    | Promise<{ roomId: string }>;
}

export default async function PlayPage({ params }: PlayPageProps) {
  const resolvedParams = await params;
  const { supabase, user } = await requireAuthenticatedUser();

  // Fetch room
  const { data: room, error } = await supabase
    .from("rooms")
    .select("id, host_id, name, theme, seed, status")
    .eq("id", resolvedParams.roomId)
    .is("deleted_at", null)
    .single();

  if (error || !room) {
    redirect("/app");
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("room_members")
    .select("user_id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    redirect("/app");
  }

  const theme: MvpTheme = isMvpTheme(room.theme) ? room.theme : "forest";

  return (
    <GameSession
      theme={theme}
      seed={room.seed}
      roomId={room.id}
    />
  );
}
