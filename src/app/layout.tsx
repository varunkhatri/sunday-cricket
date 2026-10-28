import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import InstallApp from "@/components/InstallApp";
import { isAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sunday Cricket",
  description: "Ball-by-ball scores, match reports and stats for our Sunday cricket",
  applicationName: "Sunday Cricket",
  appleWebApp: { capable: true, title: "Sunday Cricket", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/favicon-64.png", sizes: "64x64", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0f3d2e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const admin = isAdmin();
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Nav admin={admin} />
        <main className="mx-auto max-w-5xl px-4 pb-24 pt-4 sm:pt-6">
          <InstallApp />
          {children}
        </main>
        <footer className="mx-auto max-w-5xl px-4 pb-8 text-center text-xs muted">
          🏏 Sunday Cricket · made for the gang
        </footer>
      </body>
    </html>
  );
}
