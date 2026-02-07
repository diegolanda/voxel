"use client";

import { useEffect } from "react";
import { reportError } from "../lib/error-reporter";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: "global", digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="container">
          <section className="card">
            <h1>Something went wrong</h1>
            <p className="muted">An unexpected error occurred.</p>
            <button className="button" onClick={reset}>
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
