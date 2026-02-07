import Link from "next/link";

interface AuthPageProps {
  searchParams?:
    | {
        error?: string;
        notice?: string;
        email?: string;
      }
    | Promise<{
        error?: string;
        notice?: string;
        email?: string;
      }>;
}

export default async function LoginPage({ searchParams }: AuthPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <h1>Welcome back</h1>
        <p className="muted text-center">
          Sign in with a magic link sent to your email.
        </p>
        {resolvedSearchParams?.error ? (
          <p className="notice error">{resolvedSearchParams.error}</p>
        ) : null}
        {resolvedSearchParams?.notice ? (
          <p className="notice success">{resolvedSearchParams.notice}</p>
        ) : null}

        <form action="/auth/request-otp" method="post" className="grid">
          <input type="hidden" name="next" value="/login" />
          <label htmlFor="login-email">
            Email
            <input
              id="login-email"
              required
              type="email"
              name="email"
              defaultValue={resolvedSearchParams?.email}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          <button type="submit">Send magic link</button>
        </form>

        <p className="muted text-center">
          New here? <Link href="/signup">Create account</Link>
        </p>
      </section>
    </main>
  );
}
