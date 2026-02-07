import Link from "next/link";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { readSearchParam } from "../../../lib/query";

interface JoinPageProps {
  params:
    | {
        roomId: string;
      }
    | Promise<{
        roomId: string;
      }>;
  searchParams?:
    | {
        token?: string | string[];
        error?: string | string[];
        notice?: string | string[];
      }
    | Promise<{
        token?: string | string[];
        error?: string | string[];
        notice?: string | string[];
      }>;
}

export default async function JoinRoomPage({ params, searchParams }: JoinPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const token = readSearchParam(resolvedSearchParams?.token);
  const notice = readSearchParam(resolvedSearchParams?.notice);
  const error = readSearchParam(resolvedSearchParams?.error);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!token) {
    return (
      <main className="auth-wrap">
        <section className="auth-card">
          <h1>Invalid Invite</h1>
          <p className="notice error">Missing invite token.</p>
          <Link className="button secondary" href="/app">
            Back to dashboard
          </Link>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-wrap">
        <section className="auth-card">
          <h1>Sign in required</h1>
          <p className="muted text-center">
            You must sign in before joining a world.
          </p>
          <Link
            className="button"
            href={`/login?notice=Sign in to join room ${resolvedParams.roomId}`}
          >
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <h1>Join World</h1>
        {error ? <p className="notice error">{error}</p> : null}
        {notice ? <p className="notice success">{notice}</p> : null}

        <form
          action={`/api/rooms/${resolvedParams.roomId}/join`}
          method="post"
          className="grid"
        >
          <input type="hidden" name="token" value={token} />
          <input
            type="hidden"
            name="next"
            value={`/app/rooms/${resolvedParams.roomId}`}
          />
          <label htmlFor="join-password">
            World password
            <input
              id="join-password"
              required
              type="password"
              name="password"
              minLength={8}
              placeholder="Enter world password"
            />
          </label>
          <button type="submit">Join World</button>
        </form>
      </section>
    </main>
  );
}
