import Link from "next/link";

interface AuthPageProps {
  searchParams?: {
    error?: string;
    notice?: string;
    email?: string;
  } | Promise<{
    error?: string;
    notice?: string;
    email?: string;
  }>;
}

export default async function LoginPage({ searchParams }: AuthPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <main className="container">
      <section className="card grid">
        <h1>Sign in</h1>
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
            />
          </label>
          <button type="submit">Send OTP code</button>
        </form>

        <form action="/auth/verify-otp" method="post" className="grid">
          <label htmlFor="login-verify-email">
            Email
            <input
              id="login-verify-email"
              required
              type="email"
              name="email"
              defaultValue={resolvedSearchParams?.email}
              autoComplete="email"
            />
          </label>
          <label htmlFor="login-token">
            OTP code
            <input
              id="login-token"
              required
              type="text"
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </label>
          <input type="hidden" name="next" value="/login" />
          <button type="submit">Verify and continue</button>
        </form>

        <p className="muted">
          New here? <Link href="/signup">Create account</Link>
        </p>
      </section>
    </main>
  );
}
