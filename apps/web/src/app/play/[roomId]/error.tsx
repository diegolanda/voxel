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
    <main className="auth-wrap">
      <section className="auth-card">
        <h1>Session Error</h1>
        <p className="muted text-center">
          Something went wrong during your game session.
        </p>
        <div className="row" style={{ justifyContent: "center" }}>
          <button onClick={reset}>Retry</button>
          <Link className="button secondary" href="/app">
            Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
