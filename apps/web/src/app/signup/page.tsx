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

export default async function SignupPage({ searchParams }: AuthPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <main className="container">
      <section className="card grid">
        <h1>Create account</h1>
        <p className="muted">Use email OTP. No password is stored for account login.</p>
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
            />
          </label>
          <button type="submit">Send OTP code</button>
        </form>

        <form action="/auth/verify-otp" method="post" className="grid">
          <label htmlFor="signup-verify-email">
            Email
            <input
              id="signup-verify-email"
              required
              type="email"
              name="email"
              defaultValue={resolvedSearchParams?.email}
              autoComplete="email"
            />
          </label>
          <label htmlFor="signup-token">
            OTP code
            <input
              id="signup-token"
              required
              type="text"
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </label>
          <input type="hidden" name="next" value="/signup" />
          <button type="submit">Verify and continue</button>
        </form>

        <p className="muted">
          Have an account? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
