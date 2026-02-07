import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <h1>Terms of Service</h1>
        <p className="muted">
          This MVP is in active development. Do not store sensitive content in
          test worlds.
        </p>
        <Link className="button secondary" href="/">
          Back
        </Link>
      </section>
    </main>
  );
}
