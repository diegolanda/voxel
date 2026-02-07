import { notFound } from "next/navigation";
import { requireAuthenticatedUser } from "../../../../lib/auth";
import { readSearchParam } from "../../../../lib/query";
import Link from "next/link";

interface RoomPageProps {
  params:
    | {
        roomId: string;
      }
    | Promise<{
        roomId: string;
      }>;
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

export default async function RoomPage({ params, searchParams }: RoomPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const { supabase, user } = await requireAuthenticatedUser();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, host_id, name, theme, seed, status, invite_token, max_players")
    .eq("id", resolvedParams.roomId)
    .maybeSingle();

  if (!room) {
    notFound();
  }

  const [{ data: members }, { data: latestSave }] = await Promise.all([
    supabase
      .from("room_members")
      .select("user_id, role, joined_at, profiles(display_name, avatar_color)")
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true }),
    supabase
      .from("world_saves")
      .select("id, created_at, byte_size")
      .eq("room_id", room.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const inviteUrl = `${appUrl}/join/${room.id}?token=${room.invite_token}`;
  const isHost = room.host_id === user.id;
  const notice = readSearchParam(resolvedSearchParams?.notice);
  const error = readSearchParam(resolvedSearchParams?.error);
  const hasSave = !!latestSave;

  return (
    <main className="container">
      <section className="card">
        <div className="row">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
              <h1 style={{ margin: 0 }}>{room.name}</h1>
              <span className={`badge theme-${room.theme}`}>{room.theme}</span>
              <span className="badge status-active">{room.status}</span>
            </div>
            <div className="stat-row" style={{ marginTop: "0.5rem" }}>
              <div className="stat">
                <span className="stat-label">Seed</span>
                <span className="stat-value">{room.seed}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Players</span>
                <span className="stat-value">
                  {members?.length ?? 0}/{room.max_players}
                </span>
              </div>
              {hasSave && latestSave && (
                <div className="stat">
                  <span className="stat-label">Last Save</span>
                  <span className="stat-value">
                    {Math.round(latestSave.byte_size / 1024)} KB
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="row">
            <Link className="button secondary" href="/app">
              Back
            </Link>
            <Link className="button" href={`/play/${room.id}`}>
              {hasSave ? "Resume" : "Launch"}
            </Link>
          </div>
        </div>
      </section>

      {error ? <p className="notice error">{error}</p> : null}
      {notice ? <p className="notice success">{notice}</p> : null}

      <section className="card grid">
        <h2>Invite Link</h2>
        <div className="invite-box">{inviteUrl}</div>
        <p className="muted">Share this link with players you want to invite.</p>
      </section>

      <section className="card grid">
        <h2>Members</h2>
        {members && members.length > 0 ? (
          <div className="grid">
            {members.map((member: any) => {
              const profile = Array.isArray(member.profiles)
                ? member.profiles[0]
                : member.profiles;
              const canKick = isHost && member.role === "guest";
              const initial = (profile?.display_name ?? "?")[0].toUpperCase();
              const color = profile?.avatar_color ?? "#6b7280";

              return (
                <div key={member.user_id} className="member-row">
                  <div className="member-info">
                    <div
                      className="member-avatar"
                      style={{ background: color }}
                    >
                      {initial}
                    </div>
                    <div className="member-details">
                      <p className="member-name">
                        {profile?.display_name ?? member.user_id.slice(0, 8)}
                      </p>
                      <span className={`badge role-${member.role}`}>
                        {member.role}
                      </span>
                    </div>
                  </div>

                  {canKick ? (
                    <form action={`/api/rooms/${room.id}/kick`} method="post">
                      <input
                        type="hidden"
                        name="targetUserId"
                        value={member.user_id}
                      />
                      <input
                        type="hidden"
                        name="next"
                        value={`/app/rooms/${room.id}`}
                      />
                      <button className="danger" type="submit">
                        Kick
                      </button>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">No members yet.</p>
        )}
      </section>
    </main>
  );
}
