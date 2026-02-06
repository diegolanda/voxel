import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="container">
      <section className="card">
        <h1>Voxel Worlds</h1>
        <p className="muted">
          Private shared voxel spaces for teams and friends. Create a room, set a world
          password, share an invite token, and build together.
        </p>
        <div className="row">
          <Link className="button" href="/signup">
            Create account
          </Link>
          <Link className="button secondary" href="/login">
            Sign in
          </Link>
        </div>
      </section>

      <section className="card grid two">
        <article>
          <h2>Phase 1 Foundation</h2>
          <ul className="list">
            <li>Email OTP authentication</li>
            <li>Private room creation with invite token + password hash</li>
            <li>Room membership + host moderation controls</li>
          </ul>
        </article>
        <article>
          <h2>Policy</h2>
          <p className="muted">
            Worlds are private. Access requires an invite token and valid password. Hosts can
            manage members.
          </p>
          <div className="row">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </article>
      </section>
    </main>
  );
}
