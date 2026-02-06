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

  const { data: members } = await supabase
    .from("room_members")
    .select("user_id, role, joined_at, profiles(display_name, avatar_color)")
    .eq("room_id", room.id)
    .order("joined_at", { ascending: true });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const inviteUrl = `${appUrl}/join/${room.id}?token=${room.invite_token}`;
  const isHost = room.host_id === user.id;
  const notice = readSearchParam(resolvedSearchParams?.notice);
  const error = readSearchParam(resolvedSearchParams?.error);

  return (
    <main className="container">
      <section className="card row">
        <div>
          <h1>{room.name}</h1>
          <p className="muted">
            Theme: {room.theme} | Seed: {room.seed} | Status: {room.status}
          </p>
        </div>
        <div className="row">
          <Link className="button secondary" href="/app">
            Back to dashboard
          </Link>
          <Link className="button" href={`/play/${room.id}`}>
            Launch
          </Link>
        </div>
      </section>

      {error ? <p className="notice error">{error}</p> : null}
      {notice ? <p className="notice success">{notice}</p> : null}

      <section className="card">
        <h2>Invite link</h2>
        <p className="muted">Share this URL with your guests:</p>
        <p>{inviteUrl}</p>
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

              return (
                <article key={member.user_id} className="card row">
                  <div>
                    <p>
                      <strong>{profile?.display_name ?? member.user_id.slice(0, 8)}</strong> ({member.role})
                    </p>
                    <p className="muted">{member.user_id}</p>
                    <p className="muted">Avatar: {profile?.avatar_color ?? "unknown"}</p>
                  </div>

                  {canKick ? (
                    <form action={`/api/rooms/${room.id}/kick`} method="post">
                      <input type="hidden" name="targetUserId" value={member.user_id} />
                      <input type="hidden" name="next" value={`/app/rooms/${room.id}`} />
                      <button className="danger" type="submit">
                        Kick
                      </button>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="muted">No members found.</p>
        )}
      </section>
    </main>
  );
}
