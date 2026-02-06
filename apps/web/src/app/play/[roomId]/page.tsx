interface PlayPageProps {
  params:
    | {
        roomId: string;
      }
    | Promise<{
        roomId: string;
      }>;
}

export default async function PlayPage({ params }: PlayPageProps) {
  const resolvedParams = await params;

  return (
    <main className="container">
      <section className="card">
        <h1>Session launch placeholder</h1>
        <p className="muted">
          Room <strong>{resolvedParams.roomId}</strong> is ready for engine integration in Phase 2.
        </p>
      </section>
    </main>
  );
}
