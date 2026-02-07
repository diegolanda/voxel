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

  const [{ data: room, error }, { data: membership }, { data: profile }] =
    await Promise.all([
      supabase
        .from("rooms")
        .select("id, host_id, name, theme, seed, status")
        .eq("id", resolvedParams.roomId)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("room_members")
        .select("user_id")
        .eq("room_id", resolvedParams.roomId)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle()
    ]);

  if (error || !room || !membership) {
    redirect("/app");
  }

  const theme: MvpTheme = isMvpTheme(room.theme) ? room.theme : "forest";
  const displayName =
    profile?.display_name ??
    user.email?.split("@")[0] ??
    user.id.slice(0, 8);
  const isHost = room.host_id === user.id;

  return (
    <GameSession
      theme={theme}
      seed={room.seed}
      roomId={room.id}
      userId={user.id}
      displayName={displayName}
      isHost={isHost}
      turn={{
        url: process.env.NEXT_PUBLIC_TURN_URL ?? process.env.TURN_URL,
        username: process.env.NEXT_PUBLIC_TURN_USERNAME ?? process.env.TURN_USERNAME,
        password: process.env.NEXT_PUBLIC_TURN_PASSWORD ?? process.env.TURN_PASSWORD
      }}
    />
  );
}
