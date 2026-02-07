"use client";

import { useEffect } from "react";
import Link from "next/link";
import { reportError } from "../../../lib/error-reporter";

export default function PlayError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: "play", digest: error.digest });
  }, [error]);

  return (
    <main className="container">
      <section className="card grid">
        <h1>Game session error</h1>
        <p className="muted">
          Something went wrong during your game session.
        </p>
        <div className="row">
          <button className="button" onClick={reset}>
            Retry
          </button>
          <Link className="button secondary" href="/app">
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
