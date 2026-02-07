import Link from "next/link";

export default function LandingPage() {
  return (
    <>
      <section className="hero">
        <h1 className="hero-title">Voxel Worlds</h1>
        <p className="hero-subtitle">
          Build together in private voxel spaces. Create a world, invite your
          team, and start crafting in real time.
        </p>
        <div className="hero-actions">
          <Link className="button" href="/signup">
            Get Started
          </Link>
          <Link className="button secondary" href="/login">
            Sign In
          </Link>
        </div>
      </section>

      <div className="features">
        <div className="feature-card">
          <h3>Private Worlds</h3>
          <p>
            Every world is protected by invite tokens and passwords. Only
            approved members can join your space.
          </p>
        </div>
        <div className="feature-card">
          <h3>Real-time Multiplayer</h3>
          <p>
            Build with up to 5 players simultaneously using WebRTC peer-to-peer
            connections and spatial voice.
          </p>
        </div>
        <div className="feature-card">
          <h3>Persistent Worlds</h3>
          <p>
            Save your progress and resume any time. Your creations are always
            waiting for you.
          </p>
        </div>
      </div>

      <footer className="site-footer">
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
      </footer>
    </>
  );
}
