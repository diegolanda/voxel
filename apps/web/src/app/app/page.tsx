import { MAX_WORLDS_PER_ACCOUNT, MVP_THEMES } from "@voxel/domain";
import { requireAuthenticatedUser } from "../../lib/auth";
import { AVATAR_COLORS } from "@voxel/supabase";
import { readSearchParam } from "../../lib/query";
import Link from "next/link";

interface DashboardPageProps {
  searchParams?: {
    error?: string | string[];
    notice?: string | string[];
  } | Promise<{
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
      .order("created_at", { ascending: false })
  ]);

  const roomsWithSaves = new Set(saves?.map((s) => s.room_id) ?? []);

  const roomCount = rooms?.length ?? 0;
  const atWorldCap = roomCount >= MAX_WORLDS_PER_ACCOUNT;
  const notice = readSearchParam(resolvedSearchParams?.notice);
  const error = readSearchParam(resolvedSearchParams?.error);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <main className="container">
      <section className="card row">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Signed in as {user.email}</p>
        </div>
        <form action="/auth/logout" method="post">
          <button className="secondary" type="submit">
            Sign out
          </button>
        </form>
      </section>

      {error ? <p className="notice error">{error}</p> : null}
      {notice ? <p className="notice success">{notice}</p> : null}

      <section className="card grid">
        <h2>Profile</h2>
        <form action="/api/profile" method="post" className="grid two">
          <label htmlFor="display-name">
            Display name
            <input
              id="display-name"
              required
              name="displayName"
              defaultValue={profile?.display_name ?? ""}
              minLength={2}
              maxLength={40}
            />
          </label>

          <label htmlFor="avatar-color">
            Avatar color
            <select
              id="avatar-color"
              name="avatarColor"
              defaultValue={profile?.avatar_color?.toUpperCase() ?? AVATAR_COLORS[0]}
            >
              {AVATAR_COLORS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </label>

          <div>
            <button type="submit">Save profile</button>
          </div>
        </form>
      </section>

      <section className="card grid">
        <h2>Create world</h2>
        <p className="muted">
          Worlds owned: {roomCount}/{MAX_WORLDS_PER_ACCOUNT}
        </p>
        <form action="/api/rooms" method="post" className="grid two">
          <label htmlFor="room-name">
            Room name
            <input id="room-name" required name="name" minLength={3} maxLength={64} />
          </label>

          <label htmlFor="room-theme">
            Theme
            <select id="room-theme" name="theme" defaultValue={MVP_THEMES[0]}>
              {MVP_THEMES.map((theme) => (
                <option key={theme} value={theme}>
                  {theme}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="room-seed">
            Seed (optional)
            <input id="room-seed" name="seed" placeholder="auto-generated if empty" />
          </label>

          <label htmlFor="room-password">
            World password
            <input id="room-password" required type="password" name="password" minLength={8} />
          </label>

          <div>
            <button type="submit" disabled={atWorldCap}>
              {atWorldCap ? "World cap reached" : "Create room"}
            </button>
          </div>
        </form>
      </section>

      <section className="card grid">
        <h2>Your worlds</h2>
        {rooms && rooms.length > 0 ? (
          <div className="grid">
            {rooms.map((room) => {
              const inviteUrl = `${appUrl}/join/${room.id}?token=${room.invite_token}`;
              const hasSave = roomsWithSaves.has(room.id);
              return (
                <article key={room.id} className="card">
                  <div className="row">
                    <h3>{room.name}</h3>
                    <Link className="button secondary" href={`/app/rooms/${room.id}`}>
                      {hasSave ? "Resume" : "Open room"}
                    </Link>
                  </div>
                  <p className="muted">
                    Theme: {room.theme} | Status: {room.status} | Max players: {room.max_players}
                    {hasSave ? " | Saved" : ""}
                  </p>
                  <p className="muted">Invite: {inviteUrl}</p>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="muted">No worlds yet. Create one to start.</p>
        )}
      </section>
    </main>
  );
}
