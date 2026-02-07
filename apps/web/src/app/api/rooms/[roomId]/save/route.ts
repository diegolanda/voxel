import { NextResponse } from "next/server";
import { deserializeSnapshot, type WorldSnapshot } from "@voxel/protocol";
import { saveWorld, loadLatestSave } from "@voxel/supabase";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";

interface RouteContext {
  params: Promise<{ roomId: string }>;
}

/** POST /api/rooms/[roomId]/save — Host saves the current world snapshot. */
export async function POST(request: Request, context: RouteContext) {
  const { roomId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify host
  const { data: room } = await supabase
    .from("rooms")
    .select("id, host_id")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.host_id !== user.id) {
    return NextResponse.json({ error: "Only the host can save" }, { status: 403 });
  }

  // Read snapshot from request body (binary)
  const body = await request.arrayBuffer();
  if (body.byteLength === 0) {
    return NextResponse.json({ error: "Empty snapshot body" }, { status: 400 });
  }

  let snapshot: WorldSnapshot;
  try {
    snapshot = deserializeSnapshot(new Uint8Array(body));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid snapshot format" },
      { status: 400 }
    );
  }

  const result = await saveWorld(supabase, {
    roomId,
    userId: user.id,
    snapshot
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    saveId: result.saveId,
    storagePath: result.storagePath,
    byteSize: result.byteSize
  });
}

/** GET /api/rooms/[roomId]/save — Load the latest save for this room. */
export async function GET(_request: Request, context: RouteContext) {
  const { roomId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this room" }, { status: 403 });
  }

  const result = await loadLatestSave(supabase, roomId);

  if (!result.ok) {
    if (result.error === "no_save_found") {
      return NextResponse.json({ hasSave: false });
    }
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    hasSave: true,
    save: result.save,
    snapshot: result.snapshot
  });
}
