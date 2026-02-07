import { MAX_WORLDS_PER_ACCOUNT, MVP_THEMES } from "@voxel/domain";
import { requireAuthenticatedUser } from "../../lib/auth";
import { AVATAR_COLORS } from "@voxel/supabase";
import { readSearchParam } from "../../lib/query";
import Link from "next/link";
import { CreateWorldModal } from "../../components/ui/CreateWorldModal";
import { EditProfileModal } from "../../components/ui/EditProfileModal";

interface DashboardPageProps {
  searchParams?:
    | {
        error?: string | string[];
        notice?: string | string[];
      }
    | Promise<{
        error?: string | string[];
        notice?: string | string[];
      }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = await searchParams;
  const { supabase, user } = await requireAuthenticatedUser();

  const [{ data: profile }, { data: rooms }, { data: saves }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_color")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("rooms")
      .select("id, name, theme, seed, status, invite_token, max_players, created_at")
      .eq("host_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("world_saves")
      .select("room_id")
      .order("created_at", { ascending: false }),
  ]);

  const roomsWithSaves = new Set(saves?.map((s) => s.room_id) ?? []);
  const roomCount = rooms?.length ?? 0;
  const atWorldCap = roomCount >= MAX_WORLDS_PER_ACCOUNT;
  const notice = readSearchParam(resolvedSearchParams?.notice);
  const error = readSearchParam(resolvedSearchParams?.error);

  return (
    <main className="container">
      {error ? <p className="notice error">{error}</p> : null}
      {notice ? <p className="notice success">{notice}</p> : null}

      <section className="card row">
        <div>
          <h1>
            {profile?.display_name
              ? `Hey, ${profile.display_name}`
              : "Dashboard"}
          </h1>
          <p className="muted">
            {roomCount}/{MAX_WORLDS_PER_ACCOUNT} worlds created
          </p>
        </div>
        <EditProfileModal
          displayName={profile?.display_name ?? ""}
          avatarColor={profile?.avatar_color?.toUpperCase() ?? AVATAR_COLORS[0]}
          avatarColors={AVATAR_COLORS}
        />
      </section>

      <div className="section-header">
        <h2>Your Worlds</h2>
        <CreateWorldModal
          themes={MVP_THEMES}
          disabled={atWorldCap}
          disabledReason={atWorldCap ? "World cap reached" : undefined}
        />
      </div>

      {rooms && rooms.length > 0 ? (
        <div className="grid two">
          {rooms.map((room) => {
            const hasSave = roomsWithSaves.has(room.id);
            return (
              <div key={room.id} className="world-card">
                <div className={`world-card-accent ${room.theme}`} />
                <div className="world-card-body">
                  <h3>{room.name}</h3>
                  <div className="world-card-meta">
                    <span className={`badge theme-${room.theme}`}>
                      {room.theme}
                    </span>
                    <span className="badge status-active">{room.status}</span>
                    {hasSave && <span className="badge saved">saved</span>}
                  </div>
                  <div className="world-card-footer">
                    <span className="muted">
                      {room.max_players} players max
                    </span>
                    <Link
                      className="button"
                      href={`/app/rooms/${room.id}`}
                    >
                      {hasSave ? "Resume" : "Open"}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <p>No worlds yet. Create one to get started.</p>
        </div>
      )}
    </main>
  );
}
