import Link from "next/link";
import { requireAuthenticatedUser } from "../../lib/auth";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await requireAuthenticatedUser();

  return (
    <>
      <nav className="navbar">
        <Link className="navbar-brand" href="/app">
          <span>V</span>oxel Worlds
        </Link>
        <div className="navbar-right">
          <span className="navbar-user">{user.email}</span>
          <form action="/auth/logout" method="post">
            <button className="secondary" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </nav>
      {children}
    </>
  );
}
