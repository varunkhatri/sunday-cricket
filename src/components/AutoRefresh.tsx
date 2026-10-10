"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches the page's data every few seconds while a match is live. */
export default function AutoRefresh({ seconds = 8 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
