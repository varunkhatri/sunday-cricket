import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { isAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sunday Cricket",
  description: "Ball-by-ball scores, match reports and stats for our Sunday cricket",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f3d2e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const admin = isAdmin();
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏏</text></svg>" />
      </head>
      <body className="min-h-screen">
        <Nav admin={admin} />
        <main className="mx-auto max-w-5xl px-4 pb-24 pt-4 sm:pt-6">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-8 text-center text-xs muted">
          🏏 Sunday Cricket · made for the gang
        </footer>
      </body>
    </html>
  );
}
