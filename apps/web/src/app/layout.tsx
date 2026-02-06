import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voxel Worlds",
  description:
    "Create private voxel worlds, invite collaborators, and build together in your browser."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
