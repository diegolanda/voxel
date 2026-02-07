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

export default async function SignupPage({ searchParams }: AuthPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <h1>Create account</h1>
        <p className="muted text-center">
          Passwordless login via magic link sent to your email.
        </p>
        {resolvedSearchParams?.error ? (
          <p className="notice error">{resolvedSearchParams.error}</p>
        ) : null}
        {resolvedSearchParams?.notice ? (
          <p className="notice success">{resolvedSearchParams.notice}</p>
        ) : null}

        <form action="/auth/request-otp" method="post" className="grid">
          <input type="hidden" name="next" value="/signup" />
          <label htmlFor="signup-email">
            Email
            <input
              id="signup-email"
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
          Have an account? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
