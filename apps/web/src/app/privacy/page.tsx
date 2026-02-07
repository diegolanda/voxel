import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <h1>Privacy Policy</h1>
        <p className="muted">
          We use minimal identifiers for authentication and room membership.
          Voice recording is not part of MVP behavior.
        </p>
        <Link className="button secondary" href="/">
          Back
        </Link>
      </section>
    </main>
  );
}
