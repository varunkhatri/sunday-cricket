"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "sc-install-dismissed";
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

/** Registers the service worker and offers "Install the app" (Android/desktop button, iPhone instructions). */
export default function InstallApp() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  const path = usePathname();

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || read(DISMISS_KEY)) return;
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    if (isIos) {
      setIos(true);
      setHidden(false);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
      setHidden(false);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // keep the umpire's screens clear
  if (hidden || (!evt && !ios) || /^\/(admin|login)/.test(path)) return null;
  const dismiss = () => {
    write(DISMISS_KEY, "1");
    setHidden(true);
  };

  return (
    <div role="region" aria-label="Install the app" className="mb-4 flex items-start gap-3 rounded-2xl border border-pitch/15 bg-white p-3 shadow-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-pitch-900">Get the Sunday Cricket app</p>
        {evt ? (
          <p className="muted">Install it on your home screen — opens full-screen, like any other app.</p>
        ) : (
          <p className="muted">
            Tap <b>Share</b> <span aria-hidden>⬆️</span> at the bottom of Safari, then <b>Add to Home Screen</b>.
          </p>
        )}
        <div className="mt-2 flex gap-2">
          {evt && (
            <button
              className="btn-primary px-3 py-1.5 text-sm"
              onClick={async () => {
                await evt.prompt();
                const r = await evt.userChoice.catch(() => ({ outcome: "dismissed" }));
                if (r.outcome === "accepted") setHidden(true);
                setEvt(null);
              }}
            >
              📲 Install app
            </button>
          )}
          <button onClick={dismiss} className="rounded-lg px-2 py-1.5 text-sm text-ink/60 hover:text-ink">Not now</button>
        </div>
      </div>
    </div>
  );
}
